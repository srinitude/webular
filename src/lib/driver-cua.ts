// Cua back end: renders a page in a Chrome window on the host through
// cua-driver's background delivery only (`cua-driver call <tool> '<json>'`,
// served by the running cua-driver daemon). Opt-in: scrape uses it only for
// `--render cua`; agent-browser stays the default.
// Safety contract:
// - It drives one window the user named for webular in WEBULAR_CUA_WINDOW
//   ("<pid>:<window_id>"). It never picks the active tab on its own.
// - It calls only start_session, get_browser_state (bind), browser_navigate,
//   get_window_state (the accessibility tree, without a screenshot), page
//   get_text (when the tree has no text), and end_session. It never calls bring_to_front,
//   escalate_session, clipboard, keyboard, or desktop tools, and never sets
//   delivery_mode, so focus, the clipboard, the keyboard, and sound stay
//   with the user.
// - act --goal (src/commands/act.ts) also calls click, verify_state, and
//   parse_visual_regions on that same window, background delivery only.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Config, Effect, Layer, Predicate, Random, Schema } from 'effect'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'
import { fieldsOf, snapshot, treeText } from './cua-tree.ts'
import { Driver, driverError, makeDriver, type Steps } from './driver.ts'

const CALL_TIMEOUT_MS = 30_000

interface CuaTarget {
  pid: number
  window_id: number
}

export function cuaTarget(raw: string | undefined): CuaTarget | undefined {
  const match = /^(\d+):(\d+)$/.exec(raw ?? '')
  return match ? { pid: Number(match[1]), window_id: Number(match[2]) } : undefined
}

export const windowSetting = Effect.orElseSucceed(
  Effect.gen(function* () {
    return yield* Config.withDefault(Config.String('WEBULAR_CUA_WINDOW'), '')
  }),
  () => '',
)

const Ids = Schema.Struct({ target_id: Schema.String, tab_id: Schema.String })
const decodeIds = Schema.decodeUnknownEffect(Ids)

export const idsFromBind = (stdout: string) =>
  Effect.mapError(Effect.flatMap(fieldsOf(stdout), decodeIds), () =>
    driverError('cua', 'get_browser_state returned no target_id/tab_id'),
  )

// page get_text prints the page text; a JSON envelope with a `text` field
// is read too.
export const textFromPage = (stdout: string) =>
  Effect.flatMap(
    Effect.orElseSucceed(
      Effect.map(fieldsOf(stdout), (fields) => fields['text']),
      () => stdout,
    ),
    (text) =>
      Predicate.isString(text) && text.trim()
        ? Effect.succeed(text)
        : Effect.fail(driverError('cua', 'page get_text returned no text')),
  )

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Page text becomes paragraphs so the scrape extractor reads it like any page.
const textToHtml = (text: string) =>
  `<html><body><main>${text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join('')}</main></body></html>`

export const cuaCall = (tool: string, args: Record<string, unknown>) =>
  Effect.flatMap(resolveBin('cua-driver'), (bin) =>
    bin === null
      ? Effect.fail(driverError('cua', 'cua-driver not installed'))
      : Effect.flatMap(
          Effect.mapError(
            runProc([bin, 'call', tool, JSON.stringify(args)], { timeoutMs: CALL_TIMEOUT_MS }),
            (err) => driverError('cua', `${tool}: ${err.message}`),
          ),
          (res) =>
            res.code === 0
              ? Effect.succeed(res.stdout)
              : Effect.fail(
                  driverError('cua', `${tool}: ${res.stderr.trim() || `exit ${res.code}`}`),
                ),
        ),
  ).pipe(Effect.provide(BunServices.layer))

interface Opened extends CuaTarget {
  session: string
}

const open = Effect.fnUntraced(function* (url: string) {
  const target = cuaTarget(yield* windowSetting)
  if (!target)
    return yield* driverError(
      'cua',
      'set WEBULAR_CUA_WINDOW=<pid>:<window_id> to a window kept for webular',
    )
  const session = `webular-${yield* Random.nextInt}`
  yield* cuaCall('start_session', { session })
  const ids = yield* idsFromBind(yield* cuaCall('get_browser_state', { ...target, session }))
  yield* cuaCall('browser_navigate', { ...ids, url, session })
  return { ...target, session } satisfies Opened
})

// The window's accessibility tree comes first (2606.30697); page get_text
// covers a window whose tree holds no text.
const read = (_url: string, opened: unknown) => {
  const { pid, window_id } = opened as Opened
  const pageText = Effect.flatMap(
    cuaCall('page', { action: 'get_text', pid, window_id }),
    textFromPage,
  )
  // treeText is already plain text, so it needs only an emptiness check.
  const axText = Effect.flatMap(snapshot(cuaCall, { pid, window_id }, false), ({ elements }) => {
    const text = treeText(elements)
    return text.trim()
      ? Effect.succeed(text)
      : Effect.fail(driverError('cua', 'accessibility tree has no text'))
  })
  return Effect.map(
    Effect.catch(axText, () => pageText),
    textToHtml,
  )
}

const cuaSteps: Steps = {
  open,
  read,
  close: (opened) => Effect.ignore(cuaCall('end_session', { session: (opened as Opened).session })),
}

export const CuaLive = Layer.effect(Driver, makeDriver('cua', cuaSteps))
