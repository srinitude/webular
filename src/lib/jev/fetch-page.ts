// Page reading and answer helpers for the Jev fetch decisions in fetch.ts.
import type { JevAnswer } from './client.ts'
import { choice, picked } from './payload/index.ts'

export const MAX_BODY = 2_000
export const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
export type Options = ReadonlyArray<readonly [string, string]>

// Visible text: tags, scripts, and styles stripped.
export const visibleText = (html: string) =>
  html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
export const scriptCount = (html: string) => (html.match(/<script\b/gi) ?? []).length
export const scriptSources = (html: string) =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/gi)].map((m) => m[1]).slice(0, 5)
// Visible text with menus, headers, and footers removed.
export const mainText = (html: string) =>
  visibleText(html.replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' '))
export const CHALLENGE =
  /captcha|cf-chl|challenge-platform|just a moment|verify you are human|are you a robot/i

// One Choice in both option orders; the pick counts only when both agree.
export const bothOrders = (instructions: string, opts: Options) => ({
  pick: choice(instructions, Object.fromEntries(opts)),
  pick_reversed: choice(instructions, Object.fromEntries([...opts].reverse())),
})
export const agreed = <K extends string>(
  a: Record<string, JevAnswer>,
  bar: number,
  kinds: ReadonlyArray<K>,
): K | undefined => {
  const x = picked(a['pick'], bar, '')
  return x !== '' && x === picked(a['pick_reversed'], bar, '') && kinds.includes(x as K)
    ? (x as K)
    : undefined
}
export const SUBTASKS = [
  {
    name: 'pick',
    primitive: 'choice',
    pattern: 'confidence-routing',
    payload: { question: 'pick' },
  },
  {
    name: 'pick_reversed',
    primitive: 'choice',
    pattern: 'confidence-routing',
    payload: { question: 'pick_reversed' },
  },
] as const
