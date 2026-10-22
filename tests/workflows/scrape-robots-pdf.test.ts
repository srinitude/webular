// A PDF fetched under --ignore-robots still carries `robots: "disallowed"`.
import { expect, test } from 'bun:test'
import { scrapeWorkflow } from '../../src/workflows/scrape.ts'
import { textPdf } from '../_support/pdf-fixture.ts'

test('scrape marks a robots-disallowed PDF fetched under ignoreRobots', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname === '/robots.txt'
        ? new Response('User-agent: *\nDisallow: /p.pdf\n')
        : new Response(textPdf(1), { headers: { 'content-type': 'application/pdf' } }),
  })
  try {
    const run = await scrapeWorkflow.createRun({ runId: 'scrape-robots-pdf' })
    const out = await run.start({
      inputData: { url: `http://127.0.0.1:${server.port}/p.pdf`, ignoreRobots: true },
    })
    if (out.status !== 'success') throw new Error(`run ${out.status}`)
    expect(out.result.markdown).toContain('page 1')
    expect(out.result.robots).toBe('disallowed')
  } finally {
    await server.stop(true)
  }
})
