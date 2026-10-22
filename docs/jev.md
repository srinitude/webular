# Jev in webular

Jev is TypeSafe's fast decision model. Webular asks it small, typed questions,
such as "which of these links fits the goal?" or "is this page the one we
want?". Jev answers with a pick and a confidence. Webular's code then acts on
that answer.

Jev is optional. With no key, or with Jev turned off, every decision uses its
built-in baseline rule, and every command still works.

## What webular does with Jev

- It sends each question to TypeSafe's own API,
  `https://api.typesafe.ai/v1/systemone`, with the key as a Bearer token. With
  no TypeSafe key, it can use the Pydantic AI Gateway instead.
- It pins one model: `jev-1.14.0`, set in
  [`src/lib/jev/model.ts`](../src/lib/jev/model.ts). It never sends the
  `jev-latest` or `jev-preview` aliases.
- It runs at most 8 Jev calls at once.
- When a call fails, times out, or has no key, that decision falls back to its
  baseline. A failed call never stops a command.

The client code is in [`src/lib/jev/client.ts`](../src/lib/jev/client.ts). The
route order is in [`src/lib/jev/route.ts`](../src/lib/jev/route.ts).

## Recommended setup: the direct TypeSafe API

This is the way webular is built to reach Jev.

1. Make a key at [console.typesafe.ai/keys](https://console.typesafe.ai/keys).
2. Store it in one of the two places webular reads, shown in the next section.
3. Check it with the steps in [Check your setup](#check-your-setup).

Webular picks its route in this order. The first match wins:

1. If `WEBULAR_JEV` is `off`, it stops and uses no key.
2. The `TYPESAFE_API_KEY` environment variable.
3. The macOS Keychain item named `typesafe-ai-api-key`. On Windows and Linux
   this lookup finds no `security` tool, so webular goes on.
4. The `PYDANTIC_AI_GATEWAY_API_KEY` environment variable, sent to the
   Pydantic AI Gateway.

A TypeSafe key from step 2 or 3 goes to `TYPESAFE_BASE_URL` when it is set, or
else to `https://api.typesafe.ai`. So the direct key always wins over a gateway
key.

## Store the key

Keep the key in an environment variable or in the macOS Keychain. Never put it
in a file in the repo, a `.env` file, or a script. In the commands below,
`<your-key>` is a placeholder: type your own key in its place.

### macOS: the Keychain (best on a Mac)

This command asks for the key, so the key never lands in your shell history:

```bash
security add-generic-password -a "$USER" -s typesafe-ai-api-key -w
```

The Keychain item works on macOS only. On Windows and Linux, use an environment
variable.

### bash and zsh (macOS and Linux)

For this shell session only, read the key without showing it:

```bash
read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY
```

Or set it in one line. This form puts the key in your shell history:

```bash
export TYPESAFE_API_KEY=<your-key>
```

### fish (macOS and Linux)

This keeps the key for every new fish session:

```fish
set -Ux TYPESAFE_API_KEY <your-key>
```

### PowerShell (Windows, macOS, and Linux)

For this session only:

```powershell
$env:TYPESAFE_API_KEY = '<your-key>'
```

To keep it for your Windows user account:

```powershell
[Environment]::SetEnvironmentVariable('TYPESAFE_API_KEY', '<your-key>', 'User')
```

### cmd (Windows)

This keeps the key for new windows. Open a new window after you run it:

```bat
setx TYPESAFE_API_KEY "<your-key>"
```

## Turn Jev off

Set `WEBULAR_JEV=off`. Webular then skips the key lookup, makes no Jev calls,
and uses each decision's baseline rule. Unset the variable to turn Jev back on.

## Check your setup

`webular doctor` has a `jev` row. It names the active route, its base URL, and
the model. It then lists the models with that route's key, through
`GET <base>/v1/models`, and shows the HTTP status. It never prints the key. With
no key, or with Jev off, the row says so and still passes.

To check the key by hand, list the models it can use. Each command prints JSON
with the model names, or an error such as `401` for a bad key.

```bash
curl -fsS https://api.typesafe.ai/v1/models -H "Authorization: Bearer $TYPESAFE_API_KEY"
```

```powershell
curl.exe -fsS https://api.typesafe.ai/v1/models -H "Authorization: Bearer $env:TYPESAFE_API_KEY"
```

## Every way to reach Jev

The direct TypeSafe API comes first, and webular uses it whenever a TypeSafe
key is set. The rest reach the same model by other routes. Webular supports a
route only when it takes TypeSafe's own request at `/v1/systemone`, returns
TypeSafe's own reply, and can pin `jev-1.14.0`.

| Way to reach Jev | Key it reads | Base URL or entry point | Webular |
| --- | --- | --- | --- |
| [TypeSafe API, direct](https://docs.typesafe.ai/introduction/quickstart) | `TYPESAFE_API_KEY` | `https://api.typesafe.ai` | Works with webular |
| macOS Keychain item | `typesafe-ai-api-key` | same direct API | Works with webular (macOS only) |
| [JavaScript SDK `@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript) | `TYPESAFE_API_KEY` | `TYPESAFE_BASE_URL` | Not used; webular reads the same two settings |
| [Python SDK `typesafe-sdk`](https://docs.typesafe.ai/sdk/python) | `TYPESAFE_API_KEY` | `TYPESAFE_BASE_URL` | Not used; webular reads the same two settings |
| [OpenRouter](https://openrouter.ai/~typesafe/jev-latest/) | `OPENROUTER_API_KEY` | `https://openrouter.ai/api` | Not supported: another path, and only the alias `~typesafe/jev-latest` |
| [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe) | `AI_GATEWAY_API_KEY` | `https://ai-gateway.vercel.sh/typesafe` | Not supported: its docs name only the alias `typesafe-ai/jev` |
| [Pydantic AI Gateway](https://pydantic.dev/articles/jev-pydantic-ai-gateway) | `PYDANTIC_AI_GATEWAY_API_KEY` | `https://gateway-us.pydantic.dev/proxy/typesafe` | Works with webular, when no TypeSafe key is set |
| [Cloudflare Workers AI](https://developers.cloudflare.com/ai/models/typesafe/jev/) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | model `typesafe/jev` | Not supported: a wrapped body, and only the alias `typesafe/jev` |
| [Portkey](https://portkey.ai/docs/integrations/llms/typesafe) | `PORTKEY_API_KEY` plus your TypeSafe key | `https://api.portkey.ai/v1/decisions` | Not supported: another path, and it needs your TypeSafe key, which webular then sends to TypeSafe direct |
| [LiteLLM proxy](https://docs.litellm.ai/docs/pass_through/typesafe) | your LiteLLM key; the proxy holds the TypeSafe key | `{proxy}/typesafe/v1/systemone` | Works with webular: set `TYPESAFE_BASE_URL={proxy}/typesafe` and put the LiteLLM key in `TYPESAFE_API_KEY` |
| [Netlify AI Gateway](https://www.netlify.com/changelog/typesafe-jev-ai-gateway/) | none; Netlify adds it | the JavaScript SDK | Not supported yet |
| [AI SDK provider `@ai-sdk/typesafe-ai`](https://ai-sdk.dev/providers/ai-sdk-providers/typesafe-ai) | `TYPESAFE_AI_API_KEY` | `TYPESAFE_AI_BASE_URL` | Not supported yet |
| [Mastra classifiers](https://mastra.ai/reference/classifier/classifier) | `TYPESAFE_AI_API_KEY`, through the AI SDK provider | `@mastra/core` | Not supported yet |
| [eve](https://eve.dev/docs/guides/decide) | `AI_GATEWAY_API_KEY`, through Vercel | model `typesafe-ai/jev` | Not supported yet |

Webular reads only `TYPESAFE_API_KEY`, the Keychain item, and
`PYDANTIC_AI_GATEWAY_API_KEY`. A key for any other route does nothing in
webular.

## Other settings webular reads

- `WEBULAR_JEV=off` turns Jev off.
- `TYPESAFE_BASE_URL` sends the TypeSafe key to another API root with the same
  request shape, such as a LiteLLM proxy. Leave out the `/v1` part.
- `WEBULAR_JEV_MODEL` is for tests. It may name another versioned Jev id, such
  as `jev-1.13.0`. Webular ignores aliases there.
- `WEBULAR_JEV_REPLAY=<dir>` replays saved answers. Add `WEBULAR_JEV_RECORD=1`
  to save new ones.
- `WEBULAR_JEV_LOG=<file>` logs each call's confidence.
- `WEBULAR_JEV_CALLS=off` stops the call log that the learning loop reads.
- `WEBULAR_AGENT_MODEL=jev:jev-1.14.0` makes Jev the planner for the agent. It
  uses the same key lookup.

## Cost and limits

- Input costs $0.042 per million tokens. Output is free. See
  [Models](https://docs.typesafe.ai/models).
- Each organization has its own rate limits, shown in the
  [TypeSafe console](https://console.typesafe.ai/rate-limits). A call over the
  limit gets `429`.
- A request body can be at most 32 MiB. See
  [Request rules and errors](https://docs.typesafe.ai/api/errors).

## Sources

- [Quick start](https://docs.typesafe.ai/introduction/quickstart)
- [Models](https://docs.typesafe.ai/models)
- [System One API](https://docs.typesafe.ai/api/system-one)
- [List models](https://docs.typesafe.ai/api/list-models)
- [Request rules and errors](https://docs.typesafe.ai/api/errors)
- [SDK environment variables](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV)
- [Python SDK basic usage, with AI gateways](https://docs.typesafe.ai/sdk/python/usage/basic)
- [Agent skill](https://docs.typesafe.ai/agent-skill)
