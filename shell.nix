{ pkgs ? import <nixpkgs> { } }:

let
  libs = with pkgs; [
    alsa-lib
    openssl
  ];
in pkgs.mkShell {
  name = "clickrtraining";

  buildInputs = libs ++ (with pkgs; [
    cargo
    rustc
    gcc
    rustfmt
    pkgconf
  ]);

  RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
  RUST_BACKTRACE = 1;
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath libs;
}
