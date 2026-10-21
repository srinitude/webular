# Browser mode (Cua)

Cua browser mode keeps your own browser safe. Webular drives only a throwaway window, never your everyday browser. It covers `scrape --render cua` and `act --goal`.

## Set up the window

1. Let cua-driver start the window itself, with `browser_prepare {allow_launch:true, profile:{mode:"isolated_new"}}`. A Chrome you start yourself with `--user-data-dir` is refused with `browser_consent_required`.
2. Name that window in `WEBULAR_CUA_WINDOW` as `<pid>:<window_id>`.
3. Run `webular scrape <url> --render cua`, or `webular act --goal "<plain goal>"`.

### What webular refuses

Webular also refuses any window whose profile is not a throwaway one, for both `--render cua` and `act --goal`. Your default browser profile is never driven.

Return to the [README](../README.md) (navigation only).
