// Credentials never follow a redirect to another host.
const AUTH_HEADER = /^(authorization|proxy-authorization|cookie|.*api-key)$/i

type Headers = Record<string, string>

const withoutAuth = (headers: Headers): Headers =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !AUTH_HEADER.test(k)))

// The run for the next hop: a hop to another hostname loses the credentials.
export const hop = <R extends { opts: { headers?: Headers } }>(
  run: R,
  from: string,
  to: string,
): R =>
  !run.opts.headers || URL.parse(from)?.hostname === URL.parse(to)?.hostname
    ? run
    : { ...run, opts: { ...run.opts, headers: withoutAuth(run.opts.headers) } }
