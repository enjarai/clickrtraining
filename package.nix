{ lib
, rustPlatform
, openssl
, alsa-lib
, pkgconf }:

rustPlatform.buildRustPackage rec {
  pname = "clickrtraining";
  version = "dev.1";

  src = ./.;

  buildInputs = [
    alsa-lib
    openssl
  ];

  nativeBuildInputs = [
    pkgconf
  ];

  cargoLock.lockFile = ./Cargo.lock;
  doCheck = false;

  meta = with lib; {
    homepage = "https://github.com/enjarai/clickrtraining";
    description = "A client and host for clicker training";
    #TODO: decide on the license
    # license = licenses.mit;
  };
}
