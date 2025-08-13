{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=release-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        callPackage = pkgs.callPackage;
      in {
        devShells.default = import ./shell.nix { inherit pkgs; };
        packages.default = callPackage ./package.nix { };
      }
    );
}
