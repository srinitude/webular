// MCP App resources: the session view, built by `mise run plugin:ui` into one
// self-contained HTML file, and the tools whose results it renders. Hosts
// without MCP Apps ignore the link and read the same result as text.
import { fileURLToPath } from 'node:url'

export const SESSION_VIEW = 'ui://webular/session'

export const appResources = {
  [SESSION_VIEW]: {
    name: 'webular session',
    description:
      'Shows a research or map run: where it is, what it can do next, and every source it found.',
    htmlPath: fileURLToPath(new URL('../dist/ui/session.html', import.meta.url)),
  },
}

const linked = new Set(['research', 'map'])

export const uiMeta = (id: string) =>
  linked.has(id) ? { _meta: { ui: { resourceUri: SESSION_VIEW } } } : {}
