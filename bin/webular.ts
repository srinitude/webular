#!/usr/bin/env bun
// webular CLI entrypoint. Thin by design: parse argv, route to mise, exit.
import { route } from '../src/cli/route.ts'

process.exit(await route(Bun.argv.slice(2)))
