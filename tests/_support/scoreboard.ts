// The value bench/scoreboard.json records for one command metric. Each offline
// eval asserts its measured value equals this, so a stale scoreboard fails it.
// Fix a failure: update scripts/bench/scoreboard-rows.ts, then `mise run bench:scoreboard`.
import board from '../../bench/scoreboard.json'

export const scoreboardValue = (command: string, metric: string) =>
  // A missing or null row stays as is, so the equality check fails on it.
  board.find((r) => r.command === command && r.metric === metric)?.value as number
