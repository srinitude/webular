// Page-level robots directives: the X-Robots-Tag response header and
// <meta name="robots"> (Google's robots meta tag spec). `none` means
// noindex plus nofollow. A "bot: directive" header value applies only to that bot.
interface RobotsTags {
  readonly noindex: boolean
  readonly nofollow: boolean
}

const META = /<meta\b[^>]*>/gi
const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]
const SCOPE = /^([a-z][\w-]*)\s*:(?!\/\/)\s*(.*)$/i
const PARAMETERIZED = /^(unavailable_after|max-[\w-]+)$/i

// Header tokens, split on commas; a leading "bot:" scopes it and the tokens after it.
const headerTokens = (header: string, ua: string) => {
  const out: string[] = []
  let applies = true
  for (const raw of header.split(',')) {
    const m = SCOPE.exec(raw.trim())
    const scoped = m && !PARAMETERIZED.test(m[1] ?? '')
    if (scoped) applies = ['*', ua].includes((m[1] ?? '').toLowerCase())
    if (applies) out.push((scoped ? (m[2] ?? '') : raw).trim().toLowerCase())
  }
  return out
}

export const robotsTags = (
  headers: Headers | Record<string, string>,
  body: string,
  userAgent: string,
): RobotsTags => {
  const ua = userAgent.toLowerCase()
  const header =
    headers instanceof Headers
      ? headers.get('x-robots-tag')
      : Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-robots-tag')?.[1]
  const tokens = headerTokens(header ?? '', ua)
  for (const tag of body.match(META) ?? []) {
    const name = attr(tag, 'name')?.toLowerCase()
    if (name === 'robots' || name === ua)
      tokens.push(...(attr(tag, 'content') ?? '').split(',').map((t) => t.trim().toLowerCase()))
  }
  return {
    noindex: tokens.some((t) => t === 'noindex' || t === 'none'),
    nofollow: tokens.some((t) => t === 'nofollow' || t === 'none'),
  }
}
