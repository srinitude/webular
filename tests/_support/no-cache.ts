// Preloaded by bunfig.toml: tests never touch the real HTTP disk cache.
// cache.test.ts builds its own ConfigProvider, so it still exercises the cache.
process.env['WEBULAR_NO_CACHE'] ??= '1'
