# Security

webular treats every page, file, and URL as hostile input.

## Verify a download

The install script checks the download against SHA256SUMS. Set `WEBULAR_VERIFY_ATTESTATION=1` with `gh` installed to also check the build attestation. To check by hand:

```sh
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify webular-<build> --repo srinitude/webular
```

## What the tools can reach

The tools reach the web. In agent mode, they do not reach your own network. Requests to `localhost` or `192.168.x.x` are blocked, and files are written only inside the folder the server starts in, or `WEBULAR_OUTPUT_DIR`.

## Prompt injection

Page text can steer an agent, so agent mode turns on two guards. `webular mcp` and the plugin run in agent mode (`WEBULAR_AGENT_MODE=1`). `WEBULAR_ALLOW_PRIVATE=1` allows requests to your own network. `WEBULAR_SANDBOX=0` allows files to be written to any path. Ask the user before you set either one.

## robots.txt

`scrape` returns status `blocked` for a page that robots.txt disallows. `--ignore-robots` fetches one URL anyway and marks it `disallowed`. `crawl`, `map`, and `batch` always honor robots.txt.

## Reporting a flaw

Report it privately with the **Report a vulnerability** button on the [Security tab of the repository](https://github.com/srinitude/webular/security/advisories/new).

- Do not open a public issue for a vulnerability.
- Include the command, the input that triggers the problem, and what you expected to happen.

## Which release gets fixes

Security fixes go only into the most recent release published on npm.
