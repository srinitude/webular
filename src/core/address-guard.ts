// SSRF guard: the one place that decides whether a fetch may reach an address.
// Rule (docs/commands.md#private-addresses): a private, loopback, or link-local
// target is allowed when the user typed it on the CLI; agent mode (MCP, plugin)
// blocks it unless WEBULAR_ALLOW_PRIVATE=1; a redirect hop reaches a private
// address only when the run started on one; a redirect from https to http fails.
import { isIP } from 'node:net'
import { Config, Effect } from 'effect'
import { FetchError } from './decode.ts'

function privateV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

// IPv6 that embeds an IPv4 (mapped ::ffff:, NAT64 64:ff9b::, compatible ::), dotted
// or in the hex hhhh:hhhh form URL parsing gives, as the IPv4 it names.
function mappedV4(ip: string): string | undefined {
  const tail = /^(?:::ffff:|64:ff9b::|::)(.+)$/.exec(ip)?.[1]
  if (!tail) return undefined
  if (isIP(tail) === 4) return tail
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail)
  if (!hex) return undefined
  return v4Of(Number.parseInt(hex[1] ?? '0', 16), Number.parseInt(hex[2] ?? '0', 16))
}

const v4Of = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.')

// The eight 16-bit groups of a valid IPv6 string; a dotted IPv4 tail becomes two groups.
function hextets(ip: string): number[] {
  const hex = ip.replace(
    /(\d+)\.(\d+)\.(\d+)\.(\d+)$/,
    (_, a, b, c, d) => `${((+a << 8) | +b).toString(16)}:${((+c << 8) | +d).toString(16)}`,
  )
  const [head = '', tail = ''] = hex.split('::')
  const a = head ? head.split(':') : []
  const b = tail ? tail.split(':') : []
  const gap = hex.includes('::') ? Array(8 - a.length - b.length).fill('0') : []
  return [...a, ...gap, ...b].map((h) => Number.parseInt(h, 16))
}

// The IPv4 a tunnel address carries: 6to4 2002:V4HI:V4LO::/48, Teredo 2001:0::/32
// with the client IPv4 in the last 32 bits, each bit flipped.
function tunnelV4(ip: string): string | undefined {
  const h = hextets(ip)
  if (h[0] === 0x2002) return v4Of(h[1] ?? 0, h[2] ?? 0)
  if (h[0] === 0x2001 && h[1] === 0) return v4Of(~(h[6] ?? 0) & 0xffff, ~(h[7] ?? 0) & 0xffff)
  return undefined
}

/** True for loopback, RFC 1918, link-local, CGNAT, unspecified, multicast, ULA, site-local, and IPv6 forms embedding them (mapped, NAT64, 6to4, Teredo). */
export function isPrivateIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, '').toLowerCase()
  if (isIP(ip) === 4) return privateV4(ip)
  if (isIP(ip) !== 6) return false
  const mapped = mappedV4(ip) ?? tunnelV4(ip)
  if (mapped) return privateV4(mapped)
  if (ip === '::' || ip === '::1') return true
  return /^(f[cd]|fe[89a-f]|ff)/.test(ip)
}

const lookup = (host: string) =>
  Effect.tryPromise({
    try: () => Bun.dns.lookup(host, {}),
    catch: () => new FetchError({ message: `could not resolve ${host}` }),
  }).pipe(Effect.map((rows) => rows.map((r) => r.address)))

// Every address the host resolves to, from two lookups in a row, so a name that
// switches to a private address between them (DNS rebinding) is caught; a literal
// IP resolves to itself.
// ponytail: re-resolve, not pin. Bun's fetch takes no resolved address and looks
// the name up again, so an answer that switches only after both lookups still
// gets through. Upgrade path: a fetch that accepts a pinned IP or a custom connect.
const resolve = (host: string) =>
  isIP(host.replace(/^\[|\]$/g, ''))
    ? Effect.succeed([host])
    : Effect.map(Effect.all([lookup(host), lookup(host)], { concurrency: 1 }), (both) =>
        both.flat(),
      )

/** True when the URL's host is localhost or resolves to any private address. */
const resolvesPrivate = (url: string) => {
  const host = URL.parse(url)?.hostname ?? ''
  if (host === 'localhost' || host.endsWith('.localhost')) return Effect.succeed(true)
  return Effect.map(resolve(host), (ips) => ips.some(isPrivateIp))
}

const flag = (config: Config.Config<string>) =>
  config.pipe(
    Config.withDefault(''),
    Effect.map((v) => v === '1'),
    Effect.orElseSucceed(() => false),
  )

const blocked = (url: string, why: string) =>
  new FetchError({
    message: `blocked: ${why} (${URL.parse(url)?.host ?? url}); set WEBULAR_ALLOW_PRIVATE=1 to allow it`,
  })

/** The hop that redirected here, and whether the run started on a private address. */
interface HopFrom {
  url: string
  originPrivate: boolean
}

/** Checks one request target before it is sent; succeeds with whether it is private. */
export const guardTarget = Effect.fn('guardTarget')(function* (url: string, from?: HopFrom) {
  const downgrade =
    from && URL.parse(from.url)?.protocol === 'https:' && URL.parse(url)?.protocol === 'http:'
  if (downgrade) return yield* Effect.fail(blocked(url, 'redirect from https to http'))
  const isPrivate = yield* resolvesPrivate(url)
  if (!isPrivate || (yield* flag(Config.String('WEBULAR_ALLOW_PRIVATE')))) return isPrivate
  if (from && !from.originPrivate)
    return yield* Effect.fail(blocked(url, 'redirect to a private address'))
  if (yield* flag(Config.String('WEBULAR_AGENT_MODE')))
    return yield* Effect.fail(blocked(url, 'private address in agent mode'))
  return isPrivate
})
