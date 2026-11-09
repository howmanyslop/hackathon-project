#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import process, { argv, env, exit } from "node:process";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import { type } from "arktype";

import { createBaseCommand } from "$script-functions/create-base-command";
import { createLogger } from "$script-logging/logger";

import {
	advance,
	classify,
	getClusterHealth,
	lookFor,
	LOOKS,
	pickNodeNames,
	toGlobalCommand,
	toSegmentCommand,
} from "./wled/zones";

import type { ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import type { ClusterHealth, ControlPlaneNode, Look, Zone } from "./wled/zones";

const log = createLogger("wled-cluster-status");
// One shared SSH connection: a fresh handshake takes seconds and delays polls.

const SSH_OPTIONS = [
	"-o",
	"BatchMode=yes",
	"-o",
	"ControlMaster=auto",
	"-o",
	"ControlPersist=120",
	"-o",
	`ControlPath=${nodePath.join(tmpdir(), "wled-ssh-%C")}`,
	"-o",
	"ServerAliveInterval=5",
];

const SERIAL_PORT_PATTERN = /^\/dev\/[\w./-]+$/u;

const RADAR_TIMEOUT_MILLISECONDS = 8000;
const RESPAWN_MILLISECONDS = 3000;
const RESYNC_MILLISECONDS = 30_000;
const STALE_MILLISECONDS = 8000;
const TICK_MILLISECONDS = 250;
const WATCH_SCRIPT = readFileSync(new URL("wled/node-watch.py", import.meta.url), "utf8");
const ZONE_COUNT = 4;

const WatchLine = type({
	"error?": "string",
	"nodes?": type({
		name: "string",
		controlPlane: "boolean",
		reachable: "boolean",
		ready: "boolean",
		unschedulable: "boolean",
	}).array(),
});

const RadarIssues = type({ issues: type({ severity: "string" }).array() });

interface Options {
	readonly brightness: number;
	readonly dryRun: boolean;
	readonly interval: number;
	readonly leds: number;
	readonly nodes?: string;
	readonly port: string;
	readonly preview: boolean;
	readonly radarCluster: string;
	readonly radarInterval: number;
	readonly radarToken: string;
	readonly radarUrl: string;
	readonly ssh: string;
}

type Serial = ChildProcessByStdio<Writable, null, null>;

type Watcher = ChildProcessByStdio<Writable, Readable, null>;

function openSerial(options: Options): Serial {
	// Opened once so the board's USB port isn't reset by repeated opens. The
	// sleep keeps each command inside the board's small receive buffer; larger
	// bursts are silently truncated by WLED.
	const script = [
		`stty -F ${options.port} 115200 raw -echo`,
		`exec 3>${options.port}`,
		String.raw`while IFS= read -r line; do printf "%s\n" "$line" >&3; sleep 0.1; done`,
	].join(" && ");

	const child = spawn("ssh", [...SSH_OPTIONS, options.ssh, script], {
		stdio: ["pipe", "inherit", "inherit"],
	});

	child.on("exit", (code) => {
		log.warn(`serial link closed (exit ${String(code)}); reconnecting on the next tick`);
	});
	child.on("error", (error) => {
		log.warn(`serial link error: ${error.message}`);
	});
	child.stdin.on("error", (error) => {
		log.warn(`serial write failed: ${error.message}`);
	});

	return child;
}

function isOpen(serial?: Serial): serial is Serial {
	return serial?.exitCode === null && !serial.stdin.destroyed;
}

interface BridgeState {
	health: ClusterHealth;
	lastNodes: Array<ControlPlaneNode>;
	lastRadarPoll: number;
	lastResync: number;
	lastSpawn: number;
	lastUpdate: number;
	names: Array<string>;
	radarFailing: boolean;
	radarPending?: Promise<void>;
	serial?: Serial;
	watcher?: Watcher;
}

function isAlive(child?: Watcher): boolean {
	return child?.exitCode === null;
}

async function runBridgeAsync(options: Options): Promise<void> {
	const zoneLength = Math.floor(options.leds / ZONE_COUNT);
	const zones: Array<undefined | Zone> = Array.from({ length: ZONE_COUNT });
	const sent: Array<string | undefined> = Array.from({ length: ZONE_COUNT });
	const radarEnabled = options.radarToken.length > 0 && options.radarCluster.length > 0;
	const state: BridgeState = {
		health: "healthy",
		lastNodes: [],
		lastRadarPoll: 0,
		lastResync: 0,
		lastSpawn: 0,
		lastUpdate: 0,
		names: options.nodes === undefined ? [] : options.nodes.split(",").map((name) => name.trim()),
		radarFailing: false,
	};

	function write(line: string): void {
		if (options.dryRun) {
			log.info(`> ${line}`);
			return;
		}

		if (!isOpen(state.serial)) {
			state.serial = openSerial(options);
			// A new link may mean a reset board, so resend every zone on the
			// next tick.
			state.lastResync = 0;
		}

		state.serial.stdin.write(`${line}\n`);
	}

	function handleLine(line: string): void {
		let raw: unknown;

		try {
			raw = JSON.parse(line);
		} catch {
			log.warn(`unreadable watcher line: ${line.slice(0, 80)}`);
			return;
		}

		const parsed = WatchLine(raw);
		if (parsed instanceof type.errors) {
			log.warn(`unreadable watcher line: ${parsed.summary}`);
			return;
		}

		if (parsed.nodes === undefined) {
			log.warn(`watcher could not read the cluster: ${parsed.error ?? "unknown error"}`);
			return;
		}

		state.lastNodes = parsed.nodes;
		state.lastUpdate = Date.now();

		if (state.names.length === 0) {
			state.names = pickNodeNames(state.lastNodes, ZONE_COUNT);
			log.info(`zones: ${state.names.join(", ")}`);
		}
	}

	function startWatcher(now: number): void {
		state.lastSpawn = now;

		const watcher = spawn("ssh", [...SSH_OPTIONS, options.ssh, `python3 -u - ${String(options.interval)}`], {
			stdio: ["pipe", "pipe", "inherit"],
		});

		watcher.stdin.end(WATCH_SCRIPT);
		createInterface({ input: watcher.stdout }).on("line", handleLine);
		watcher.on("exit", (code) => {
			log.warn(`node watcher exited (${String(code)}); restarting`);
		});
		watcher.on("error", (error) => {
			log.warn(`node watcher error: ${error.message}`);
		});
		watcher.stdin.on("error", (error) => {
			log.warn(`node watcher input failed: ${error.message}`);
		});
		state.watcher = watcher;
	}

	async function pollRadarAsync(now: number): Promise<void> {
		state.lastRadarPoll = now;

		try {
			const response = await fetch(`${options.radarUrl}/c/${options.radarCluster}/api/issues`, {
				headers: { Authorization: `Bearer ${options.radarToken}` },
				signal: AbortSignal.timeout(RADAR_TIMEOUT_MILLISECONDS),
			});

			if (!response.ok) {
				throw new Error(`Radar answered HTTP ${String(response.status)}`);
			}

			const parsed = RadarIssues(await response.json());
			if (parsed instanceof type.errors) {
				throw new TypeError(parsed.summary);
			}

			const health = getClusterHealth(parsed.issues.map((issue) => issue.severity));
			if (health !== state.health || state.radarFailing) {
				log.info(`radar: ${String(parsed.issues.length)} issue(s), cluster ${health}`);
			}

			state.health = health;
			state.radarFailing = false;
		} catch (error) {
			// Keep the last known health: a Radar outage is not a cluster
			// problem.
			if (!state.radarFailing) {
				log.warn(
					`radar unreachable, keeping ${state.health}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			state.radarFailing = true;
		} finally {
			state.radarPending = undefined;
		}
	}

	function render(now: number): void {
		if (now - state.lastResync >= RESYNC_MILLISECONDS) {
			state.lastResync = now;
			sent.fill(undefined);
			write(toGlobalCommand(options.brightness));
		}

		for (const [index, zone] of zones.entries()) {
			if (zone === undefined) continue;

			const look = lookFor(zone, now, state.health);
			if (sent[index] === look.name) continue;

			sent[index] = look.name;
			log.info(`zone ${String(index + 1)} (${state.names[index] ?? "?"}): ${look.name}`);
			write(toSegmentCommand(index, zoneLength, look));
		}
	}

	function tick(): void {
		const now = Date.now();

		if (!isAlive(state.watcher) && now - state.lastSpawn >= RESPAWN_MILLISECONDS) {
			startWatcher(now);
		}

		if (
			radarEnabled &&
			state.radarPending === undefined &&
			now - state.lastRadarPoll >= options.radarInterval * 1000
		) {
			state.radarPending = pollRadarAsync(now);
		}

		const stale = now - state.lastUpdate > STALE_MILLISECONDS;

		for (let index = 0; index < ZONE_COUNT; index += 1) {
			const name = state.names[index];
			const status =
				name === undefined || stale ? "unknown" : classify(state.lastNodes.find((node) => node.name === name));

			zones[index] = advance(zones[index], status, now);
		}

		render(now);
	}

	log.info(`bridge started (${options.dryRun ? "dry run" : options.port})`);
	log.info(
		radarEnabled
			? `radar: watching issues every ${String(options.radarInterval)}s`
			: "radar: off (set RADAR_TOKEN and RADAR_CLUSTER)",
	);

	const timer = setInterval(tick, TICK_MILLISECONDS);
	await once(process, "SIGINT");
	clearInterval(timer);
	state.watcher?.kill();
	state.serial?.stdin.end();
}

async function* eachWithPauseAsync<Item>(items: ReadonlyArray<Item>, pauseMilliseconds: number): AsyncGenerator<Item> {
	for (const item of items) {
		yield item;
		// oxlint-disable-next-line no-await-in-loop -- the pause between items is the point.
		await sleep(pauseMilliseconds);
	}
}

async function playPreviewAsync(options: Options): Promise<void> {
	const zoneLength = Math.floor(options.leds / ZONE_COUNT);
	const sequence: ReadonlyArray<Look> = [
		LOOKS.ready,
		LOOKS.degraded,
		LOOKS.critical,
		LOOKS.alert,
		LOOKS.down,
		LOOKS.recovered,
		LOOKS.cordoned,
		LOOKS.unknown,
	];
	const serial = options.dryRun ? undefined : openSerial(options);

	function write(line: string): void {
		if (serial === undefined) {
			log.info(`> ${line}`);
			return;
		}

		serial.stdin.write(`${line}\n`);
	}

	write(toGlobalCommand(options.brightness));

	for await (const look of eachWithPauseAsync(sequence, 7000)) {
		log.info(`all zones: ${look.name}`);

		for (let index = 0; index < ZONE_COUNT; index += 1) {
			write(toSegmentCommand(index, zoneLength, look));
		}
	}

	for (const [index, look] of [LOOKS.ready, LOOKS.alert, LOOKS.down, LOOKS.cordoned].entries()) {
		write(toSegmentCommand(index, zoneLength, look));
	}

	log.info("preview done: one zone per state (ready, alert, down, cordoned)");
	await sleep(8000);
	serial?.stdin.end();
}

const command = createBaseCommand(
	"wled-cluster-status",
	"1.0.0",
	"Shows each node's Kubernetes status on a WLED strip split into four zones, over USB serial through an SSH hop to the control node.",
)
	.option("--ssh <target:string>", "SSH target of the machine holding the WLED board and the k3s server.", {
		default: env.WLED_SSH_TARGET ?? "",
	})
	.option("--port <path:string>", "Serial device on that machine.", { default: "/dev/ttyACM0" })
	.option("--interval <seconds:number>", "Seconds between node status checks.", { default: 1 })
	.option("--leds <count:number>", "Total LEDs on the strip.", { default: 100 })
	.option("--brightness <value:number>", "Strip brightness, 1 to 255.", { default: 200 })
	.option(
		"--nodes <names:string>",
		"Comma-separated node names in zone order. Defaults to the control plane first, then by name.",
	)
	.option("--radar-url <url:string>", "Radar Cloud API base URL.", { default: "https://api.radarhq.io" })
	.option("--radar-cluster <id:string>", "Radar cluster id. Also read from RADAR_CLUSTER.", {
		default: env.RADAR_CLUSTER ?? "",
	})
	.option("--radar-interval <seconds:number>", "Seconds between Radar issue checks.", { default: 5 })
	.option("--dry-run", "Print the commands instead of writing to the board.")
	.option("--preview", "Play every state on the strip once, without reading the cluster.")
	.action(async (flags) => {
		const options: Options = {
			brightness: flags.brightness,
			dryRun: flags.dryRun === true,
			interval: flags.interval,
			leds: flags.leds,
			nodes: flags.nodes,
			port: flags.port,
			preview: flags.preview === true,
			radarCluster: flags.radarCluster,
			radarInterval: flags.radarInterval,
			radarToken: env.RADAR_TOKEN ?? "",
			radarUrl: flags.radarUrl.endsWith("/") ? flags.radarUrl.slice(0, -1) : flags.radarUrl,
			ssh: flags.ssh,
		};

		if (!SERIAL_PORT_PATTERN.test(options.port)) {
			throw new Error(`Invalid serial port: ${options.port}`);
		}

		if (options.ssh.length === 0 && !options.dryRun) {
			throw new Error("Set --ssh or WLED_SSH_TARGET to the user@host of the control node.");
		}

		await (options.preview ? playPreviewAsync(options) : runBridgeAsync(options));
		exit(0);
	});

await command.parse(argv.slice(2));
