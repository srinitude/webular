import { z } from 'zod'
import { metadataSchema } from '../lib/json-ld.ts'

export const scrapeInput = z.object({
  url: z.url(),
  timeoutMs: z.number().optional(),
  // Dead page (404, 410, 5xx, network error, timeout) → Wayback raw capture.
  archive: z.boolean().optional(),
  // Page needs JavaScript → render it in the background with this driver.
  render: z.enum(['agent-browser', 'cua', 'off']).optional(),
  // Fetch even when robots.txt disallows the page; only for one named URL.
  ignoreRobots: z.boolean().optional(),
})

const robotsFields = {
  // A robots.txt block: nothing was fetched.
  status: z.literal('blocked').optional(),
  reason: z.literal('robots').optional(),
  rule: z.string().optional(),
  userAgent: z.string().optional(),
  // Fetched under ignoreRobots although robots.txt disallows it.
  robots: z.literal('disallowed').optional(),
}

const backends = z.enum(['agent-browser', 'cua'])

export const scrapeOutput = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  text: z.string(),
  links: z.array(z.string()),
  metadata: metadataSchema.optional(),
  archivedFrom: z.string().optional(),
  renderedBy: backends.optional(),
  ...robotsFields,
})

export const fetched = z.object({
  url: z.string(),
  html: z.string(),
  archivedFrom: z.string().optional(),
  markdown: z.string().optional(),
  renderedBy: backends.optional(),
  blockedBy: z.string().optional(),
  robots: robotsFields.robots,
})
