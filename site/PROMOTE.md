# Promote webular.dev to production

This page puts a checked preview of webular.dev and its docs into production. Run it only after every design score passes.

## Before you start

- You are signed in to wrangler. `bun node_modules/wrangler/bin/wrangler.js whoami` shows the account.
- You run each command from the `site` folder.
- A preview upload exists. The steps under [Make a preview](#make-a-preview) made it, and every page in it returned 200.

## Make a preview

Build the site and the docs, copy the docs into the site output, then upload a Worker version that takes no traffic yet:

```bash
mise run site:build
mise run docs:build
bun ../scripts/docs-content.ts --publish
bun node_modules/wrangler/bin/wrangler.js versions upload --tag "$(git rev-parse --short HEAD)" --message "webular.dev redesign preview"
```

The upload prints a `Worker Version ID`. Production keeps serving what it served before.

The upload prints no `Version Preview URL`, because [wrangler.jsonc](wrangler.jsonc) leaves the `workers.dev` route off. So check the same `dist` folder on your own machine. Run `wrangler dev` under Node, since under Bun it answers every request with 503:

```bash
node node_modules/wrangler/bin/wrangler.js dev --local --ip 127.0.0.1 --port 8798
```

In a second shell, run the page check from [Check after the promote](#check-after-the-promote) with `http://127.0.0.1:8798` as the only host. To do that, change the `for host in` line to `for host in http://127.0.0.1:8798; do`. Run the 404 check with the same host.

## Promote

Send all traffic on webular.dev and www.webular.dev to the previewed upload. In each command below, put its `Worker Version ID` in place of `VERSION_ID`.

First, rehearse the step. This form changes nothing and ends with `--dry-run: exiting`:

```bash
bun node_modules/wrangler/bin/wrangler.js versions deploy VERSION_ID@100% --message "webular.dev redesign" --yes --dry-run
```

Then run the same command without `--dry-run` to promote:

```bash
bun node_modules/wrangler/bin/wrangler.js versions deploy VERSION_ID@100% --message "webular.dev redesign" --yes
```

Do not use `mise run site:deploy` here. It builds the site again, which clears the docs out of `dist`, and it uploads a build that no one has checked.

## Check after the promote

1. Confirm that production runs the previewed upload:

   ```bash
   bun node_modules/wrangler/bin/wrangler.js deployments status
   ```

   The output lists `VERSION_ID` at 100%.

2. Confirm that every page answers 200 on both domains:

   ```bash
   for host in https://webular.dev https://www.webular.dev; do
     find dist -name '*.html' | sed -e 's#^dist##' -e 's#/index\.html$#/#' -e 's#\.html$##' |
       while read -r path; do
         printf '%s %s%s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$host$path")" "$host" "$path"
       done
   done | sort > /tmp/webular-status.txt
   awk '{print $1}' /tmp/webular-status.txt | uniq -c
   grep -v '^200 ' /tmp/webular-status.txt
   ```

   The count shows only 200, and the last command prints nothing.

3. Confirm that a missing page answers 404:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://webular.dev/no-such-page
   ```

## Roll back

Send all traffic back to what ran before the promote:

```bash
bun node_modules/wrangler/bin/wrangler.js rollback --yes
```
