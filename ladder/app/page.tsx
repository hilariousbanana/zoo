"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Ladder, { Rungs, traceColumn, colorFor } from "@/components/Ladder";

const MIN = 2;
const MAX = 8;
const DENSITY = 0.45; // probability of a rung at each eligible slot
const INITIAL_SEED = 1; // fixed seed so SSR and first client render match

/** Small deterministic PRNG so a given seed always yields the same ladder. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Generate a valid ladder: no two horizontal rungs touch the same column at the same row. */
function generateRungs(count: number, seed: number): Rungs {
  const rng = mulberry32(seed);
  const rows = count * 3 + 2;
  const result: Rungs = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = new Array(count - 1).fill(false);
    for (let c = 0; c < count - 1; c++) {
      if (c > 0 && row[c - 1]) continue; // keep rungs non-adjacent
      if (rng() < DENSITY) row[c] = true;
    }
    result.push(row);
  }
  return result;
}

function defaultNames(n: number) {
  return Array.from({ length: n }, (_, i) => `참가자 ${i + 1}`);
}
function defaultPrizes(n: number) {
  const pool = ["꽝", "당첨 🎁", "커피 ☕", "꽝", "청소 🧹", "간식 🍪", "1등 🏆", "꽝"];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

export default function Home() {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState<string[]>(() => defaultNames(4));
  const [prizes, setPrizes] = useState<string[]>(() => defaultPrizes(4));
  const [rungs, setRungs] = useState<Rungs>(() => generateRungs(4, INITIAL_SEED));
  const [riding, setRiding] = useState<number[]>([]); // circles riding down now
  const [parked, setParked] = useState<number[]>([]); // circles that arrived
  const [runId, setRunId] = useState(0);
  const [editMode, setEditMode] = useState(false); // editing names vs. running
  const animating = riding.length > 0;

  // After hydration, swap the fixed-seed ladder for a fresh random one.
  // (Random generation during render would cause an SSR/client mismatch.)
  useEffect(() => {
    setRungs(generateRungs(4, randomSeed()));
  }, []);

  // Map each starting column to its destination column.
  const destinations = useMemo(
    () => names.map((_, i) => traceColumn(i, rungs)),
    [names, rungs]
  );

  const resize = useCallback((next: number) => {
    const n = Math.min(MAX, Math.max(MIN, next));
    setCount(n);
    setNames((prev) => {
      const copy = prev.slice(0, n);
      while (copy.length < n) copy.push(`참가자 ${copy.length + 1}`);
      return copy;
    });
    setPrizes((prev) => {
      const copy = prev.slice(0, n);
      const fill = defaultPrizes(n);
      while (copy.length < n) copy.push(fill[copy.length]);
      return copy;
    });
    setRungs(generateRungs(n, randomSeed()));
    setRiding([]);
    setParked([]);
  }, []);

  const shuffle = useCallback(() => {
    if (animating) return;
    setRungs(generateRungs(count, randomSeed()));
    setRiding([]);
    setParked([]);
  }, [animating, count]);

  // One player's circle rides down (ignored if it already went or is busy).
  const run = useCallback(
    (i: number) => {
      if (animating || parked.includes(i)) return;
      setRiding([i]);
      setRunId((n) => n + 1);
    },
    [animating, parked]
  );

  // Every circle that hasn't gone yet rides down together.
  const runAll = useCallback(() => {
    if (animating) return;
    const remaining = Array.from({ length: count }, (_, i) => i).filter(
      (i) => !parked.includes(i)
    );
    if (remaining.length === 0) return;
    setRiding(remaining);
    setRunId((n) => n + 1);
  }, [animating, count, parked]);

  const onAnimationEnd = useCallback(() => {
    setParked((prev) => Array.from(new Set([...prev, ...riding])));
    setRiding([]);
  }, [riding]);

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col gap-2 overflow-hidden px-4 py-3 sm:gap-3 sm:py-4">
      <header className="text-center">
        <h1 className="bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-3xl">
          🪜 사다리타기
        </h1>
        <p className="mt-1 hidden text-sm text-gray-400 sm:block">
          참가자와 결과를 정하고 이름을 눌러 사다리를 타보세요!
        </p>
      </header>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-2 py-1.5">
          <button
            onClick={() => resize(count - 1)}
            disabled={count <= MIN || animating}
            aria-label="인원 줄이기"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg font-bold transition hover:bg-white/20 disabled:opacity-30"
          >
            −
          </button>
          <span className="min-w-[4.5rem] text-center text-sm">
            인원 <span className="font-bold text-emerald-300">{count}</span>명
          </span>
          <button
            onClick={() => resize(count + 1)}
            disabled={count >= MAX || animating}
            aria-label="인원 늘리기"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg font-bold transition hover:bg-white/20 disabled:opacity-30"
          >
            +
          </button>
        </div>

        <button
          onClick={shuffle}
          disabled={animating}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-40"
        >
          🔀 사다리 섞기
        </button>
        <button
          onClick={runAll}
          disabled={animating || editMode}
          className="rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 px-4 py-2 text-sm font-bold text-gray-900 transition hover:brightness-110 disabled:opacity-40"
        >
          🏁 전체 출발
        </button>
        <button
          onClick={() => setEditMode((v) => !v)}
          disabled={animating}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${
            editMode
              ? "bg-amber-400 text-gray-900 hover:bg-amber-300"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          {editMode ? "✓ 완료" : "✎ 이름 수정"}
        </button>
      </div>

      {/* top labels — tap a name to send that circle down (or edit in edit mode) */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {names.map((name, i) => {
          const done = parked.includes(i);
          return editMode ? (
            <input
              key={`name-${i}`}
              value={name}
              onChange={(e) =>
                setNames((p) =>
                  p.map((v, idx) => (idx === i ? e.target.value : v))
                )
              }
              aria-label={`참가자 ${i + 1} 이름`}
              className="w-full truncate rounded-md border-b-2 bg-white/5 px-1 py-1.5 text-center text-xs font-semibold outline-none transition focus:bg-white/10 sm:text-sm"
              style={{ borderColor: colorFor(i), color: colorFor(i) }}
            />
          ) : (
            <button
              key={`name-${i}`}
              onClick={() => run(i)}
              disabled={animating || done}
              aria-label={`${name || `참가자 ${i + 1}`} 출발`}
              className="w-full truncate rounded-md border-b-2 bg-white/5 px-1 py-1.5 text-center text-xs font-bold outline-none transition hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed sm:text-sm"
              style={{
                borderColor: colorFor(i),
                color: colorFor(i),
                opacity: done ? 0.45 : 1,
              }}
            >
              {done ? "✓ " : ""}
              {name || `참가자 ${i + 1}`}
            </button>
          );
        })}
      </div>

      {/* the ladder — flexes to fill remaining height so nothing scrolls */}
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-2">
        <Ladder
          count={count}
          rungs={rungs}
          riding={riding}
          parked={parked}
          runId={runId}
          onAnimationEnd={onAnimationEnd}
          onPick={editMode ? undefined : run}
        />
      </div>

      {/* bottom labels — editable prizes, reveal result */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {prizes.map((prize, i) => {
          // Which player landed here (if they've arrived)?
          const winnerStart = destinations.findIndex(
            (d, idx) => d === i && parked.includes(idx)
          );
          const isWinner = winnerStart !== -1;
          return (
            <div key={`prize-${i}`} className="flex flex-col items-center gap-1">
              <input
                value={prize}
                onChange={(e) =>
                  setPrizes((p) =>
                    p.map((v, idx) => (idx === i ? e.target.value : v))
                  )
                }
                aria-label={`결과 ${i + 1}`}
                className="w-full truncate rounded-md border-t-2 border-white/30 bg-white/5 px-1 py-1.5 text-center text-xs font-semibold text-gray-200 outline-none transition focus:bg-white/10 sm:text-sm"
              />
              {isWinner && (
                <span
                  className="animate-pop-in truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-gray-900 sm:text-xs"
                  style={{ backgroundColor: colorFor(winnerStart) }}
                >
                  {names[winnerStart]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* hint */}
      <p className="text-center text-xs text-gray-500">
        {editMode
          ? "이름을 수정한 뒤 ‘완료’를 누르세요"
          : "위의 이름이나 출발점의 공을 눌러 사다리를 타세요"}
      </p>
    </main>
  );
}
