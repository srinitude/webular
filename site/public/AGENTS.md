# site/public/AGENTS.md

Files Astro copies to the build as they are, under [site/AGENTS.md](../AGENTS.md).

## Rules

- [_redirects](_redirects) sends the install scripts and `/latest` to GitHub Release assets with a 302, because the target moves with each release ([Cloudflare redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)).
- [_headers](_headers) sets the content type of Markdown and text files, since its rules override Cloudflare's defaults ([Cloudflare headers](https://developers.cloudflare.com/workers/static-assets/headers/)).
- [llms.txt](llms.txt) is also the source of the home page twin and sets the order of llms-full.txt.
