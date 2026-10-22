// Credentials never follow a redirect to another host.
const AUTH_HEADER = /^(authorization|proxy-authorization|cookie|.*api-key)$/i

type Headers = Record<string, string>

const hasAuth = (headers: Headers | undefined) =>
  Object.keys(headers ?? {}).some((k) => AUTH_HEADER.test(k))

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

// Credentialed requests follow redirects by hand, so each hop can drop the credentials.
export const manualIfAuth = <O extends { headers?: Headers }>(opts: O) =>
  hasAuth(opts.headers) ? { ...opts, redirect: 'manual' as const } : opts
