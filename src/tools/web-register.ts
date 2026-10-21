// Loosens a command tool's input schema for registration.
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
