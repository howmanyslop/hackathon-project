import { Link } from "@tanstack/react-router";

import { createSessionSearch } from "$features/session/session-search";
import { formatTimeLabel } from "$lib/time-label";

import type { ReactNode } from "react";

import type { QuestionPair } from "$archive/contract";

export interface TimelineStripProperties {
	lengthMs: number;
	pairs: ReadonlyArray<QuestionPair>;
	qaStartMs: number | undefined;
	sessionId: number;
}

const WIDTH = 1000;
const HEIGHT = 64;
const TICK_TARGET_WIDTH = 24;

function toX(milliseconds: number, lengthMs: number): number {
	return (Math.min(Math.max(milliseconds, 0), lengthMs) / lengthMs) * WIDTH;
}

/**
 * The talk from left to right: a hairline where Q&A starts and a tick in the
 * question color where each question was asked. Each tick jumps to it.
 *
 * @param properties - The session's length, Q&A mark, and pairs.
 * @returns An SVG of the talk in a well, with a time scale under it.
 */
export function TimelineStrip({ lengthMs, pairs, qaStartMs, sessionId }: Readonly<TimelineStripProperties>): ReactNode {
	const length = Math.max(lengthMs, 1);
	// Where the Q&A hairline sits, as a share of the strip's width.
	const qaPercent = qaStartMs === undefined ? 0 : (toX(qaStartMs, length) / WIDTH) * 100;
	return (
		<div className="well">
			<svg className="timeline" preserveAspectRatio="none" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
				<title>{`The talk from 0:00 to ${formatTimeLabel(length)}, with ${pairs.length} questions marked`}</title>
				<line
					stroke="var(--rule)"
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
					x1={0}
					x2={WIDTH}
					y1={32}
					y2={32}
				/>
				{qaStartMs === undefined ? null : (
					<line
						stroke="var(--ink-3)"
						strokeWidth={1}
						vectorEffect="non-scaling-stroke"
						x1={toX(qaStartMs, length)}
						x2={toX(qaStartMs, length)}
						y1={0}
						y2={HEIGHT}
					/>
				)}
				{pairs.map((pair) => (
					<Link
						key={pair.ordinal}
						aria-label={`Question ${pair.ordinal + 1} at ${formatTimeLabel(pair.startMs)}`}
						params={{ sessionId: String(sessionId) }}
						search={createSessionSearch(pair.startMs)}
						to="/sessions/$sessionId"
					>
						{/* An invisible, wider target, so a tap near the 2px tick still lands. */}
						<rect
							fill="transparent"
							height={HEIGHT}
							width={TICK_TARGET_WIDTH}
							x={toX(pair.startMs, length) - TICK_TARGET_WIDTH / 2}
							y={0}
						/>
						<line
							stroke="var(--question)"
							strokeWidth={2}
							vectorEffect="non-scaling-stroke"
							x1={toX(pair.startMs, length)}
							x2={toX(pair.startMs, length)}
							y1={12}
							y2={52}
						/>
					</Link>
				))}
			</svg>
			<div className="axis-label timeline-axis">
				<span>{"0:00"}</span>
				{qaStartMs === undefined ? null : (
					<span
						className={qaPercent > 50 ? "timeline-qa is-before" : "timeline-qa"}
						style={{ left: `${qaPercent}%` }}
					>
						{`Q&A from ${formatTimeLabel(qaStartMs)}`}
					</span>
				)}
				<span>{formatTimeLabel(length)}</span>
			</div>
		</div>
	);
}
