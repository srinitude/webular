// Shared by the document parsers: the typed failure and its Effect wrappers.
import { Config, Data, Effect } from 'effect'
import { errMsg } from '../core/output.ts'

export class ParseError extends Data.TaggedError('ParseError')<{ readonly message: string }> {}

export const fail = (message: string) => Effect.fail(new ParseError({ message }))
export const attempt = <A>(run: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(run()),
    catch: (e) => new ParseError({ message: errMsg(e) }),
  })

export const setting = (name: string, fallback: number) =>
  Config.Int(name).pipe(
    Config.withDefault(fallback),
    Effect.mapError((e) => new ParseError({ message: `parse: ${name}: ${errMsg(e)}` })),
  )
