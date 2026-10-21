// Registers the MCP App views on a server; each view reads its built page on
// demand, from the plugin's own resource list. Also loosens a command tool's
// input schema for registration.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Data, Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import { catch as orRawInput, z } from 'zod'
import { appResources } from '../../plugins/webular/src/apps.ts'

class AppNotBuilt extends Data.TaggedError('AppNotBuilt')<{ readonly message: string }> {}

// The MCP Apps media type, as the plugin's Mastra server lists it.
const APP_MIME = 'text/html;profile=mcp-app'

// The SDK checks input before the handler and answers in its own words. Each
// field passes a bad value on as is, so the CLI judges it and its usage error
// reaches the agent. Unknown keys still fail. tools/list is unchanged: the
// catch adds no JSON Schema, since it gives undefined with no input.
export const lenient = (schema: z.ZodObject<z.ZodRawShape>) =>
  z.strictObject(
    Object.fromEntries(
      Object.entries(schema.shape).map(([k, f]) => [
        k,
        orRawInput(f as z.ZodType, (c) => c?.input as never),
      ]),
    ),
  )

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
