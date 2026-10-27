import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '../../source'

// The export writes the index to /docs/api/search; the browser searches it.
export const revalidate = false
export const { staticGET: GET } = createFromSource(source)
