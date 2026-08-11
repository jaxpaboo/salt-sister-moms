// Generates the project id format the spec calls for: todaysdate + nnn.
// todaysdate is YYYYMMDD and nnn is a 3-digit zero-padded counter that resets
// each calendar day. The counter is the count of *existing* projects created
// on the same day, so the next id is `count + 1`.
//
// We pass the existing list in rather than reading it from Firebase directly
// so the same code path can be unit-tested without the network.

import { Project } from './project';

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1, 2);
  const d = pad(now.getDate(), 2);
  return `${y}${m}${d}`;
}

/** Generate the next project id for `now`, given the existing projects. */
export function nextProjectId(existing: Project[], now: Date = new Date()): string {
  const key = todayKey(now);
  const todays = existing.filter((p) => p.project_id?.startsWith(key));
  return `${key}${pad(todays.length + 1, 3)}`;
}
