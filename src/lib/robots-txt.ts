// robots.txt per RFC 9309: user-agent groups, longest-match Allow/Disallow
// with `*` and `$`, Crawl-delay, a 500 KiB parse cap, and the status rules
// (4xx = allow all, 5xx or network error = disallow all).

interface RobotsRule {
  readonly allow: boolean
  readonly pattern: string
}

export interface Robots {
  readonly rules: ReadonlyArray<RobotsRule>
  readonly crawlDelayMs: number
}

const ALLOW_ALL: Robots = { rules: [], crawlDelayMs: 0 }
const DISALLOW_ALL: Robots = { rules: [{ allow: false, pattern: '/' }], crawlDelayMs: 0 }

/** RFC 9309 section 2.5: parsers must read at least 500 KiB. */
export const MAX_ROBOTS_BYTES = 500 * 1024

interface Group {
  agents: string[]
  rules: RobotsRule[]
  crawlDelayMs: number
}

const productToken = (userAgent: string) => (userAgent.split('/')[0] ?? '').trim().toLowerCase()

const splitGroups = (text: string): Group[] => {
  const groups: Group[] = []
  let current: Group | undefined
  let lastWasAgent = false
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelayMs: 0 }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if ((key === 'allow' || key === 'disallow') && value)
      current.rules.push({ allow: key === 'allow', pattern: value })
    else if (key === 'crawl-delay' && Number.isFinite(Number(value)))
      current.crawlDelayMs = Math.max(current.crawlDelayMs, Number(value) * 1000)
  }
  return groups
}

/** Parses the first 500 KiB; groups naming this agent merge, else the `*` groups apply. */
export const parseRobots = (body: string, userAgent: string): Robots => {
  const text = new TextDecoder().decode(
    new TextEncoder().encode(body).subarray(0, MAX_ROBOTS_BYTES),
  )
  const groups = splitGroups(text)
  const token = productToken(userAgent)
  const named = groups.filter((g) => g.agents.includes(token))
  const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes('*'))
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelayMs: Math.max(0, ...chosen.map((g) => g.crawlDelayMs)),
  }
}

/** Status rules: 2xx parse, 4xx (and unfollowed 3xx) allow all, 5xx, status 0, or no response disallow all. */
export const robotsFromResponse = (
  response: { status: number; body: string } | null,
  userAgent: string,
): Robots => {
  if (!response || response.status === 0 || response.status >= 500) return DISALLOW_ALL
  if (response.status >= 200 && response.status < 300) return parseRobots(response.body, userAgent)
  return ALLOW_ALL
}

const escapeRegex = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
const toRegex = (pattern: string) => {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map(escapeRegex).join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

// ponytail: compiles each pattern per check, O(rules · path); cache compiled
// regexes per host if robots checks show up in a profile.
/** The deciding rule: longest matching pattern wins; on a tie Allow wins; none for /robots.txt. */
export const matchedRule = (robots: Robots, path: string): RobotsRule | undefined => {
  if (path === '/robots.txt') return undefined
  let best: RobotsRule | undefined
  for (const rule of robots.rules) {
    if (!toRegex(rule.pattern).test(path)) continue
    const longer = !best || rule.pattern.length > best.pattern.length
    const tieAllow = best && rule.pattern.length === best.pattern.length && rule.allow
    if (longer || tieAllow) best = rule
  }
  return best
}

export const isAllowed = (robots: Robots, path: string): boolean =>
  matchedRule(robots, path)?.allow ?? true
