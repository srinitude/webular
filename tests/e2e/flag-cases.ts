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
  {
    name: 'scrape unknown flag',
    cmd: 'scrape',
    args: ['{origin}/a', '--no-such-flag'],
    code: 2,
    err: 'unknown option',
    maxChars: 400,
    maxMs: 3000,
  },
  {
    name: 'batch archive flag',
    cmd: 'batch',
    args: ['--urls', '{origin}/a', '--archive', '--json'],
    json: true,
    maxChars: 6000,
    maxMs: 8000,
  },
  { name: 'scrape help', cmd: 'scrape', args: ['--help'], maxChars: 2000, maxMs: 3000 },
]
