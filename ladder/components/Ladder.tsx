"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

// useLayoutEffect runs before paint (needed to start the ride with no flicker),
// but warns during SSR — fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type Rungs = boolean[][]; // [row][col], col length = count - 1

type Point = { x: number; y: number };

const COLORS = [
  "#f87171", // red
  "#fbbf24", // amber
  "#34d399", // emerald
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#a3e635", // lime
];

export function colorFor(i: number) {
  return COLORS[i % COLORS.length];
}

// Geometry constants (SVG user units; the SVG scales responsively via viewBox).
const MARGIN_X = 28;
const COL_GAP = 64;
const TOP_Y = 14;
const BOTTOM_Y = 14;

type Geometry = {
  width: number;
  height: number;
  topY: number;
  bottomY: number;
  x: (col: number) => number;
  yRow: (row: number) => number;
};

function buildGeometry(count: number, rows: number): Geometry {
  const width = MARGIN_X * 2 + (count - 1) * COL_GAP;
  const ladderHeight = Math.max(rows * 34, 240);
  const topY = TOP_Y;
  const bottomY = topY + ladderHeight;
  const height = bottomY + BOTTOM_Y;
  return {
    width,
    height,
    topY,
    bottomY,
    x: (col) => MARGIN_X + col * COL_GAP,
    yRow: (row) => topY + ((row + 1) * ladderHeight) / (rows + 1),
  };
}

/** Follow the ladder from a starting column to its destination column. */
export function traceColumn(start: number, rungs: Rungs): number {
  let c = start;
  for (let r = 0; r < rungs.length; r++) {
    if (c > 0 && rungs[r][c - 1]) c -= 1;
    else if (c < rungs[r].length && rungs[r][c]) c += 1;
  }
  return c;
}

function buildPathPoints(start: number, rungs: Rungs, geo: Geometry): Point[] {
  const pts: Point[] = [{ x: geo.x(start), y: geo.topY }];
  let c = start;
  for (let r = 0; r < rungs.length; r++) {
    const y = geo.yRow(r);
    if (c > 0 && rungs[r][c - 1]) {
      pts.push({ x: geo.x(c), y });
      pts.push({ x: geo.x(c - 1), y });
      c -= 1;
    } else if (c < rungs[r].length && rungs[r][c]) {
      pts.push({ x: geo.x(c), y });
      pts.push({ x: geo.x(c + 1), y });
      c += 1;
    }
  }
  pts.push({ x: geo.x(c), y: geo.bottomY });
  return pts;
}

function pointsToPath(pts: Point[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

const DURATION_MS = 2800;

type LadderProps = {
  count: number;
  rungs: Rungs;
  /** Columns whose circles are currently riding down. */
  riding: number[];
  /** Columns whose circles have already arrived and rest at the bottom. */
  parked: number[];
  /** Bumped on every run so re-selecting the same column replays the animation. */
  runId?: number;
  /** Called once the ride animation completes. */
  onAnimationEnd?: () => void;
  /** Called when a waiting circle is clicked (to send it down). */
  onPick?: (col: number) => void;
};

export default function Ladder({
  count,
  rungs,
  riding,
  parked,
  runId = 0,
  onAnimationEnd,
  onPick,
}: LadderProps) {
  const geo = useMemo(() => buildGeometry(count, rungs.length), [count, rungs.length]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ridingPaths = useMemo(
    () =>
      riding.map((start) => ({
        start,
        d: pointsToPath(buildPathPoints(start, rungs, geo)),
      })),
    [riding, rungs, geo]
  );

  // Already-arrived circles: keep a faint trail and a dot at the destination.
  const parkedPaths = useMemo(
    () =>
      parked.map((start) => ({
        start,
        dest: traceColumn(start, rungs),
        d: pointsToPath(buildPathPoints(start, rungs, geo)),
      })),
    [parked, rungs, geo]
  );

  // Circles still waiting at their start peg (not riding, not arrived).
  const waiting = useMemo(() => {
    const busy = new Set([...riding, ...parked]);
    return Array.from({ length: count }, (_, i) => i).filter((i) => !busy.has(i));
  }, [count, riding, parked]);

  // Start every riding circle's SMIL motion as soon as it is committed.
  // The paths/markers are keyed by runId, so they remount fresh each run; we
  // call beginElement() before paint to position circles at their start point
  // (avoids the document-timeline snap-to-end bug of inserted begin="0s").
  useIsomorphicLayoutEffect(() => {
    if (riding.length === 0) return;
    svgRef.current
      ?.querySelectorAll("animateMotion")
      .forEach((el) => (el as SVGAnimationElement).beginElement());
  }, [riding, runId]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      width="100%"
      className="block h-auto w-full select-none touch-none"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="사다리"
    >
      {/* vertical lines */}
      {Array.from({ length: count }).map((_, i) => (
        <line
          key={`v-${i}`}
          x1={geo.x(i)}
          y1={geo.topY}
          x2={geo.x(i)}
          y2={geo.bottomY}
          stroke={colorFor(i)}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.55}
        />
      ))}

      {/* small pegs at every endpoint */}
      {Array.from({ length: count }).map((_, i) => (
        <g key={`dots-${i}`}>
          <circle cx={geo.x(i)} cy={geo.topY} r={4} fill={colorFor(i)} opacity={0.4} />
          <circle cx={geo.x(i)} cy={geo.bottomY} r={4} fill={colorFor(i)} opacity={0.4} />
        </g>
      ))}

      {/* horizontal rungs */}
      {rungs.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <line
              key={`h-${r}-${c}`}
              x1={geo.x(c)}
              y1={geo.yRow(r)}
              x2={geo.x(c + 1)}
              y2={geo.yRow(r)}
              stroke="#cbd5e1"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.5}
            />
          ) : null
        )
      )}

      {/* faint completed trails for circles that already arrived */}
      {parkedPaths.map(({ start, d }) => (
        <path
          key={`parked-trail-${start}`}
          d={d}
          fill="none"
          stroke={colorFor(start)}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
        />
      ))}

      {/* trail drawn behind each riding circle */}
      {ridingPaths.map(({ start, d }, idx) => (
        <path
          key={`path-${start}-${runId}`}
          d={d}
          fill="none"
          stroke={colorFor(start)}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={{
            animation: `ladder-draw ${DURATION_MS}ms ease-in-out forwards`,
            filter: "drop-shadow(0 0 6px currentColor)",
          }}
          // Fire the completion callback once, off the first path.
          onAnimationEnd={
            idx === 0
              ? (e) => {
                  if (e.animationName === "ladder-draw") onAnimationEnd?.();
                }
              : undefined
          }
        />
      ))}

      {/* circles waiting at their start peg (click to send down) */}
      {waiting.map((i) => (
        <circle
          key={`wait-${i}`}
          cx={geo.x(i)}
          cy={geo.topY}
          r={9}
          fill={colorFor(i)}
          stroke="#fff"
          strokeWidth={2}
          onClick={onPick ? () => onPick(i) : undefined}
          style={{
            filter: "drop-shadow(0 0 4px currentColor)",
            cursor: onPick ? "pointer" : "default",
          }}
        />
      ))}

      {/* circles resting at their destination after arriving */}
      {parkedPaths.map(({ start, dest }) => (
        <circle
          key={`park-${start}`}
          cx={geo.x(dest)}
          cy={geo.bottomY}
          r={9}
          fill={colorFor(start)}
          stroke="#fff"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 4px currentColor)" }}
        />
      ))}

      {/* circles currently riding down the ladder */}
      {ridingPaths.map(({ start, d }) => (
        <circle
          key={`marker-${start}-${runId}`}
          r={10}
          fill={colorFor(start)}
          stroke="#fff"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
        >
          <animateMotion
            begin="indefinite"
            dur={`${DURATION_MS}ms`}
            fill="freeze"
            calcMode="spline"
            keyPoints="0;1"
            keyTimes="0;1"
            keySplines="0.42 0 0.58 1"
            path={d}
          />
        </circle>
      ))}
    </svg>
  );
}
