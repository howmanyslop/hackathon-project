export type NodeStatus = "cordoned" | "down" | "ready" | "unknown";

export type ClusterHealth = "critical" | "degraded" | "healthy";

export type Rgb = readonly [number, number, number];

export interface Look {
	readonly name: string;
	readonly colors: readonly [Rgb, Rgb];
	readonly effect: number;
	readonly intensity: number;
	readonly palette: number;
	readonly speed: number;
}

export interface KubeNode {
	readonly name: string;
	readonly reachable: boolean;
	readonly ready: boolean;
	readonly unschedulable: boolean;
}

export interface ControlPlaneNode extends KubeNode {
	readonly controlPlane: boolean;
}

export interface Zone {
	readonly recovering: boolean;
	readonly since: number;
	readonly status: NodeStatus;
}

// WLED v16 effect and palette ids.
const EFFECT = { blink: 1, breathe: 2, colorwaves: 67, fireworks: 42, heartbeat: 100, solid: 0 } as const;
const PALETTE = { colorOne: 2, colorsOneAndTwo: 3, forest: 10 } as const;

const AMBER: Rgb = [255, 120, 0];
const GOLD: Rgb = [255, 215, 0];
const ORANGE: Rgb = [255, 140, 0];
const RED_ORANGE: Rgb = [255, 45, 0];
const BLACK: Rgb = [0, 0, 0];
const DIM_RED: Rgb = [24, 0, 0];
const RED: Rgb = [255, 0, 0];
const WHITE_DIM: Rgb = [28, 28, 28];

export const ALERT_MILLISECONDS = 6000;
export const RECOVERY_MILLISECONDS = 9000;

export const LOOKS = {
	alert: {
		name: "alert",
		colors: [RED, BLACK],
		effect: EFFECT.blink,
		intensity: 128,
		palette: PALETTE.colorOne,
		speed: 220,
	},
	cordoned: {
		name: "cordoned",
		colors: [AMBER, BLACK],
		effect: EFFECT.breathe,
		intensity: 128,
		palette: PALETTE.colorOne,
		speed: 70,
	},
	critical: {
		name: "critical",
		colors: [RED_ORANGE, ORANGE],
		effect: EFFECT.colorwaves,
		intensity: 128,
		palette: PALETTE.colorsOneAndTwo,
		speed: 110,
	},
	degraded: {
		name: "degraded",
		colors: [ORANGE, GOLD],
		effect: EFFECT.colorwaves,
		intensity: 128,
		palette: PALETTE.colorsOneAndTwo,
		speed: 60,
	},
	down: {
		name: "down",
		colors: [RED, DIM_RED],
		effect: EFFECT.heartbeat,
		intensity: 128,
		palette: PALETTE.colorOne,
		speed: 90,
	},
	ready: {
		name: "ready",
		colors: [BLACK, BLACK],
		effect: EFFECT.colorwaves,
		intensity: 128,
		palette: PALETTE.forest,
		speed: 36,
	},
	recovered: {
		name: "recovered",
		colors: [BLACK, BLACK],
		effect: EFFECT.fireworks,
		intensity: 190,
		palette: PALETTE.forest,
		speed: 140,
	},
	unknown: {
		name: "unknown",
		colors: [WHITE_DIM, BLACK],
		effect: EFFECT.solid,
		intensity: 128,
		palette: PALETTE.colorOne,
		speed: 128,
	},
} as const satisfies Record<string, Look>;

export function classify(node?: KubeNode): NodeStatus {
	if (node === undefined || !node.ready || !node.reachable) return "down";

	return node.unschedulable ? "cordoned" : "ready";
}

export function advance(zone: undefined | Zone, status: NodeStatus, now: number): Zone {
	if (zone === undefined) {
		return { recovering: false, since: now, status };
	}

	if (zone.status === status) return zone;

	return { recovering: zone.status === "down" && status === "ready", since: now, status };
}

export function lookFor(zone: Zone, now: number, health: ClusterHealth = "healthy"): Look {
	const age = now - zone.since;

	if (zone.status === "down") return age < ALERT_MILLISECONDS ? LOOKS.alert : LOOKS.down;

	if (zone.status === "ready") {
		if (health !== "healthy") return LOOKS[health];

		return zone.recovering && age < RECOVERY_MILLISECONDS ? LOOKS.recovered : LOOKS.ready;
	}

	return LOOKS[zone.status];
}

export function getClusterHealth(severities: ReadonlyArray<string>): ClusterHealth {
	if (severities.includes("critical")) return "critical";

	return severities.length > 0 ? "degraded" : "healthy";
}

export function toSegmentCommand(index: number, zoneLength: number, look: Look): string {
	const start = index * zoneLength;

	return JSON.stringify({
		seg: {
			id: index,
			col: [look.colors[0], look.colors[1], BLACK],
			fx: look.effect,
			ix: look.intensity,
			on: true,
			pal: look.palette,
			start,
			stop: start + zoneLength,
			sx: look.speed,
		},
	});
}

export function toGlobalCommand(brightness: number): string {
	return JSON.stringify({ bri: brightness, on: true, transition: 8 });
}

export function pickNodeNames(nodes: ReadonlyArray<ControlPlaneNode>, count: number): Array<string> {
	return [...nodes]
		.toSorted((a, b) => Number(b.controlPlane) - Number(a.controlPlane) || a.name.localeCompare(b.name))
		.slice(0, count)
		.map((node) => node.name);
}
