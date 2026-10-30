{ lib, stdenv, fetchurl, autoPatchelfHook }:

let
  sources = {
    aarch64-darwin = {
      url = "https://github.com/srinitude/webular/releases/download/v0.3.2/webular-darwin-arm64";
      sha256 = "add0c3e536d18979a2f730617e6df13c25042b73279939da725955f76ca7729f";
    };
    x86_64-darwin = {
      url = "https://github.com/srinitude/webular/releases/download/v0.3.2/webular-darwin-x64";
      sha256 = "970c4d32ce80549e7470de8ebf8cc0478352c80a0ce44f6dfad9017f35b7bf84";
    };
    x86_64-linux = {
      url = "https://github.com/srinitude/webular/releases/download/v0.3.2/webular-linux-x64";
      sha256 = "4725f4995f471ed4e3e4740e43533f03e75611473ad1aef1d0406f260361dc70";
    };
    aarch64-linux = {
      url = "https://github.com/srinitude/webular/releases/download/v0.3.2/webular-linux-arm64";
      sha256 = "b81d523a60b451dbb36948a7ea3258e1ca961378cfa4642715c4bbc7a82bb84e";
    };
  };
  system = stdenv.hostPlatform.system;
  source = sources.${system} or (throw "webular: unsupported system ${system}");
in
stdenv.mkDerivation {
  pname = "webular";
  version = "0.3.2";

  src = fetchurl { inherit (source) url sha256; };
  dontUnpack = true;
  dontStrip = true;
  nativeBuildInputs = lib.optionals stdenv.hostPlatform.isLinux [ autoPatchelfHook ];
  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ stdenv.cc.cc.lib ];

  installPhase = ''
    runHook preInstall
    install -Dm755 $src $out/bin/webular
    runHook postInstall
  '';

  meta = {
    description = "Universal web research CLI";
    homepage = "https://github.com/srinitude/webular";
    license = lib.licenses.asl20;
    mainProgram = "webular";
    platforms = builtins.attrNames sources;
  };
}
