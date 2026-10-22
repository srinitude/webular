// Media gold: pages to capture an image of. A task passes when the arm returns
// an image for the page (an `image:` line). The fixture page is local, so only
// webular reaches it; the public page runs on every arm that has a media API.
import type { Task } from './model.ts'

const media = (id: string, url: string, localOnly: boolean): Task => ({
  id,
  job: 'media',
  suite: 'media',
  input: { url },
  checks: [{ kind: 'contains', values: ['image:'] }],
  ...(localOnly ? { localOnly } : {}),
})

export const mediaTasks: readonly Task[] = [
  media('media-fixture-article', '{fixture}/article', true),
  media('media-example-com', 'https://example.com/', false),
]
