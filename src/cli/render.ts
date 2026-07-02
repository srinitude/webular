// Per-command human rendering: one map, tiny renderers. The machine shape is
// the --json contract; stdout (and -o) carry what a human reads. Typing the
// map over CommandName makes a missing renderer a compile error.
import type { CommandName } from './commands.ts'

type Rec = Record<string, unknown>
type Renderer = (r: Rec) => string

const str = (r: Rec, key: string): string => (typeof r[key] === 'string' ? (r[key] as string) : '')
const num = (r: Rec, key: string): number => (typeof r[key] === 'number' ? (r[key] as number) : 0)
const arr = (r: Rec, key: string): Rec[] => (Array.isArray(r[key]) ? (r[key] as Rec[]) : [])
const strs = (r: Rec, key: string): string[] => (Array.isArray(r[key]) ? (r[key] as string[]) : [])

function renderExtract(r: Rec): string {
  if (r.data && typeof r.data === 'object') {
    return Object.entries(r.data as Rec)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n')
  }
  return strs(r, 'matches').join('\n')
}

function renderBatch(r: Rec): string {
  const results = arr(r, 'results')
  const rows = results.map((x) =>
    x.ok === true
      ? `ok   ${str(x, 'url')}  ${str(x, 'title')}`
      : `fail ${str(x, 'url')}  ${str(x, 'error')}`,
  )
  const okCount = results.filter((x) => x.ok === true).length
  return [...rows, `ok ${okCount}/${num(r, 'count')}`].join('\n')
}

function renderAnswer(r: Rec): string {
  const sources = arr(r, 'sources').map((s) => `- ${str(s, 'title')}  ${str(s, 'url')}`)
  return `${str(r, 'answer')}\n\nSources:\n${sources.join('\n')}`
}

function renderMonitor(r: Rec): string {
  const head = `${str(r, 'changeStatus')} ${str(r, 'url')}`
  const diff = str(r, 'diff')
  return diff ? `${head}\n${diff}` : head
}

const RENDERERS: Record<CommandName, Renderer> = {
  scrape: (r) => str(r, 'markdown'),
  parse: (r) => str(r, 'markdown'),
  research: (r) => str(r, 'report'),
  summarize: (r) => str(r, 'summary'),
  answer: renderAnswer,
  search: (r) =>
    arr(r, 'results')
      .map(
        (h, i) => `${i + 1}. ${str(h, 'title')}\n   ${str(h, 'url')}\n   ${str(h, 'description')}`,
      )
      .join('\n'),
  crawl: (r) =>
    arr(r, 'pages')
      .map((p) => `${str(p, 'url')}\t${str(p, 'title')}`)
      .join('\n'),
  map: (r) => strs(r, 'links').join('\n'),
  extract: renderExtract,
  media: (r) =>
    `${str(r, 'action')} ${str(r, 'url')} -> ${str(r, 'savedTo')} (${num(r, 'bytes')} bytes)`,
  monitor: renderMonitor,
  batch: renderBatch,
  doctor: (r) =>
    arr(r, 'checks')
      .map((c) => `${c.ok === true ? 'ok  ' : 'fail'} ${str(c, 'name')} ${str(c, 'detail')}`)
      .join('\n'),
  tasks: (r) => strs(r, 'tasks').join('\n'),
  diagram: (r) => strs(r, 'diagrams').join('\n'),
  mcp: (r) => strs(r, 'tools').join('\n'),
  audit: (r) =>
    `deepsec: ${r.available === true ? 'available' : 'not installed'}\ncommand: ${str(r, 'command')}`,
  act: (r) =>
    str(r, 'screenshot')
      ? `${str(r, 'snapshot')}\nscreenshot: ${str(r, 'screenshot')}`
      : str(r, 'snapshot'),
}

export function renderFor(name: string): ((data: unknown) => string) | undefined {
  const renderer = (RENDERERS as Record<string, Renderer | undefined>)[name]
  if (!renderer) return undefined
  return (data) => (data && typeof data === 'object' ? renderer(data as Rec) : String(data))
}
