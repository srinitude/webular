// Registers the MCP App views on a server; each view reads its built page on
// demand, from the plugin's own resource list.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Data, Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import { appResources } from '../../plugins/webular/src/apps.ts'

class AppNotBuilt extends Data.TaggedError('AppNotBuilt')<{ readonly message: string }> {}

// The MCP Apps media type, as the plugin's Mastra server lists it.
const APP_MIME = 'text/html;profile=mcp-app'

// ponytail: htmlPath is a checkout path; embed the pages when the compiled
// executable needs to serve views.
const readApp = (uri: string, htmlPath: string) =>
  Effect.tryPromise({
    try: () => Bun.file(htmlPath).text(),
    catch: () => new AppNotBuilt({ message: `${uri} is not built. Run \`mise run plugin:ui\`.` }),
  }).pipe(Effect.map((text) => ({ contents: [{ uri, mimeType: APP_MIME, text }] })))

export const registerApps = (
  server: McpServer,
  runWith: <A, E>(
    effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
  ) => Promise<A>,
) => {
  for (const [uri, app] of Object.entries(appResources)) {
    server.registerResource(
      app.name,
      uri,
      { description: app.description, mimeType: APP_MIME },
      () => runWith(readApp(uri, app.htmlPath)),
    )
  }
}
