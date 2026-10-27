import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'

const docs = defineDocs({ dir: 'content/docs' })

// Next adds the /docs base path to every link, so the loader's base URL is /.
export const source = loader({ baseUrl: '/', source: docs.toFumadocsSource() })
