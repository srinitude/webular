// Registration metadata for the MCP tools: input loosening and tool hints.
import { catch as orRawInput, z } from 'zod'

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

// tools/list already carries each command tool's top-level title; drop the
// plugin server's copy inside annotations to keep the list in its token budget.
export const hintsOnly = <C extends { annotations: { title?: string } }>({
  annotations,
  ...config
}: C) => {
  const { title: _, ...hints } = annotations
  return { ...config, annotations: hints }
}

const webTitles: Record<string, string> = {
  'machine.next': 'Step a flow machine',
  'web.fetch': 'Fetch a page',
  'web.links': 'List links in HTML',
  'web.markdown': 'Convert HTML to Markdown',
  'web.readability': 'Extract article text',
}

// Title and hints for a web tool: all read only; only web.fetch reaches the web.
export const webMeta = ({ id, description }: { id: string; description: string }) => ({
  title: webTitles[id] ?? id,
  description,
  annotations: { readOnlyHint: true, openWorldHint: id === 'web.fetch' },
})
