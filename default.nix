# Non-flake entry point: `nix-build` or `nix-env -if .` builds the same
# derivation the flake exposes as packages.<system>.webular.
{ pkgs ? import <nixpkgs> { } }:
pkgs.callPackage ./webular.nix { }
