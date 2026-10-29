# Nix flake for the webular CLI. webular.nix is the derivation that
# src/release/nix.ts writes from a release's SHA256SUMS: it fetches that
# release's prebuilt binary for the host system and installs it as bin/webular.
#   nix run github:srinitude/webular -- --version
#   nix profile install github:srinitude/webular
{
  description = "Search, scrape, crawl, and answer with sources, from your own machine";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (pkgs: rec {
        webular = pkgs.callPackage ./webular.nix { };
        default = webular;
      });
    };
}
