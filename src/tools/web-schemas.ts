// Input schemas for the web tools in web.ts.
import { z } from 'zod'
import { paging } from './web-machine.ts'

export const pagingSchema = z.object(paging)
// Only web URLs: a bare z.url() also takes file:, javascript:, and data:.
const httpUrl = z.url({ protocol: /^https?$/ })
// Strict: an unknown key fails the call instead of vanishing.
export const fetchSchema = z.strictObject({
  url: httpUrl,
  timeoutMs: z.number().int().positive().optional(),
  ...paging,
})
export const readabilitySchema = z.strictObject({ html: z.string(), ...paging })
export const markdownSchema = z.strictObject({ html: z.string(), ...paging })
export const linksSchema = z.strictObject({
  html: z.string(),
  base: httpUrl,
  limit: z.number().int().min(1).max(1000).optional(),
  ...paging,
})
