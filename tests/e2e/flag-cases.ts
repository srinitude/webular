// Shared-flag e2e cases that live beside cases.ts, which spreads them into CLI_CASES.
import type { CliCase } from './cases.ts'

export const FLAG_CASES: CliCase[] = [
  {
    name: 'no-cache flag',
    cmd: 'scrape',
    args: ['--url', '{origin}/a', '--no-cache', '--json'],
    json: true,
    maxChars: 6000,
    maxMs: 8000,
    via: 'bin',
  },
]
