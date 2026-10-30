# Runtime image for webular: the musl Linux release binary on Alpine. Build
# from a checkout that holds the release assets in dist/bin (`mise run
# compile:all`), for both platforms through buildx:
#   docker buildx build --platform linux/amd64,linux/arm64 -t webular .
# The release workflow's docker job runs the same build on each release tag and
# pushes it as ghcr.io/srinitude/webular:<version> (and :latest).
# buildx sets TARGETARCH (amd64 or arm64). Bun executables need libgcc and
# libstdc++ on Alpine (https://bun.com/docs/installation).
FROM alpine:3.22@sha256:d406446bc05b82480756ce8f1287964d28768c23955fa9480d2a74a2eae7a654 AS pick
ARG TARGETARCH
COPY dist/bin/webular-linux-x64-musl dist/bin/webular-linux-arm64-musl /assets/
RUN case "$TARGETARCH" in \
      amd64) cpu=x64 ;; \
      arm64) cpu=arm64 ;; \
      *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && install -m 0755 "/assets/webular-linux-${cpu}-musl" /webular

FROM alpine:3.22@sha256:d406446bc05b82480756ce8f1287964d28768c23955fa9480d2a74a2eae7a654
RUN apk add --no-cache libgcc libstdc++
LABEL org.opencontainers.image.source="https://github.com/srinitude/webular"
COPY --from=pick /webular /usr/local/bin/webular
ENTRYPOINT ["webular"]
