// The doctor network probe never reads its response, so it must cancel the body;
// the bench curl baseline must end options with `--` before the URL.
import { expect, test } from 'bun:test'

test('doctor releases the probe response body', async () => {
  const src = await Bun.file(`${import.meta.dir}/../../src/lib/doctor.ts`).text()
  expect(src).toMatch(/res\.body\?\.cancel\(\)/)
})

test('curl baseline passes the URL after --', async () => {
  const src = await Bun.file(`${import.meta.dir}/../../scripts/bench/peers/baselines.ts`).text()
  expect(src).toContain("['curl', '-sL', '--', url]")
})
