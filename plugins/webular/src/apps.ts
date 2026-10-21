// MCP App resources: one view per shape text shows badly, each built by
// `mise run plugin:ui` into one self-contained HTML file, and the tools whose
// results each renders. Hosts without MCP Apps ignore the link and read the
// same result as text.
import { fileURLToPath } from 'node:url'

export const SESSION_VIEW = 'ui://webular/session'
export const MAP_VIEW = 'ui://webular/map'
export const MONITOR_VIEW = 'ui://webular/monitor'

const built = (file: string) => fileURLToPath(new URL(`../dist/ui/${file}`, import.meta.url))

export const appResources = {
  [SESSION_VIEW]: {
    name: 'webular session',
    description:
      'Shows a research or answer run: its status, each source read or failed, and which source backs each citation.',
    htmlPath: built('session.html'),
  },
  [MAP_VIEW]: {
    name: 'webular site map',
    description:
      'Shows a map or crawl run as a site tree. Each folder has a count. Failed pages stay in the tree.',
    htmlPath: built('map.html'),
  },
  [MONITOR_VIEW]: {
    name: 'webular page changes',
    description: 'Shows a monitor check: new, same, or changed, with the change side by side.',
    htmlPath: built('monitor.html'),
  },
}

const links: Record<string, string> = {
  research: SESSION_VIEW,
  answer: SESSION_VIEW,
  map: MAP_VIEW,
  crawl: MAP_VIEW,
  monitor: MONITOR_VIEW,
}

export const uiMeta = (id: string) =>
  links[id] ? { _meta: { ui: { resourceUri: links[id] } } } : {}
