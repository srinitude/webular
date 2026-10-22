// Contract for robots.txt (RFC 9309): group choice, longest match with * and $,
// Allow winning ties, Crawl-delay, status rules, and the 500 KiB parse cap.
import { expect, test } from 'bun:test'
import {
  isAllowed,
  MAX_ROBOTS_BYTES,
  parseRobots,
  robotsFromResponse,
} from '../../src/lib/robots-txt.ts'

const FILE = `
User-agent: *
Disallow: /private
Allow: /private/open
Disallow: /*.pdf$
Crawl-delay: 2

User-agent: webular
User-agent: otherbot
Disallow: /only-webular
Allow: /page
Disallow: /page
`

const cases: [string, string, string, boolean][] = [
  ['star group blocks prefix', 'somebot', '/private/x', false],
  ['longer Allow beats shorter Disallow', 'somebot', '/private/open/a', true],
  ['$ anchors the end', 'somebot', '/doc.pdf', false],
  ['$ does not match a longer path', 'somebot', '/doc.pdf?x=1', true],
  ['unmatched path is allowed', 'somebot', '/public', true],
  ['named group replaces the star group', 'webular/1.0', '/private/x', true],
  ['named group rule applies', 'WebUlar', '/only-webular', false],
  ['equal-length tie goes to Allow', 'webular', '/page', true],
  ['robots.txt is always allowed', 'somebot', '/robots.txt', true],
]

for (const [name, agent, path, allowed] of cases)
  test(`robots: ${name}`, () => {
    expect(isAllowed(parseRobots(FILE, agent), path)).toBe(allowed)
  })

test('robots: Crawl-delay is read in milliseconds for the chosen group', () => {
  expect(parseRobots(FILE, 'somebot').crawlDelayMs).toBe(2000)
  expect(parseRobots(FILE, 'webular').crawlDelayMs).toBe(0)
})

const statusCases: [string, { status: number; body: string } | null, boolean][] = [
  ['404 means no rules', { status: 404, body: 'Disallow: /' }, true],
  ['403 means no rules', { status: 403, body: '' }, true],
  ['500 means disallow all', { status: 500, body: '' }, false],
  ['503 means disallow all', { status: 503, body: '' }, false],
  ['network error means disallow all', null, false],
  ['status 0 (unreachable) means disallow all', { status: 0, body: '' }, false],
  ['200 parses the body', { status: 200, body: 'User-agent: *\nDisallow: /x' }, false],
]

for (const [name, response, allowed] of statusCases)
  test(`robots status: ${name}`, () => {
    expect(isAllowed(robotsFromResponse(response, 'webular'), '/x')).toBe(allowed)
  })

test('robots: rules past 500 KiB are ignored', () => {
  const padding = `# ${'x'.repeat(MAX_ROBOTS_BYTES)}\n`
  const body = `User-agent: *\nDisallow: /early\n${padding}Disallow: /late\n`
  const robots = parseRobots(body, 'webular')
  expect(isAllowed(robots, '/early')).toBe(false)
  expect(isAllowed(robots, '/late')).toBe(true)
})
