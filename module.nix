{
  packages
}: (
  {
    lib,
    pkgs,
    config,
    ...
  }:

  let
    inherit (lib)
      mkEnableOption
      mkIf
      mkOption
      optionalAttrs
      optional
      mkPackageOption;
    inherit (lib.types)
      bool
      path
      str
      submodule
      number
      array
      listOf;

    cfg = config.services.clickrtraining;
  in
  {
    options.services.clickrtraining = {
      enable = mkEnableOption "Clickrtraining";

      package = mkPackageOption packages.${pkgs.stdenv.hostPlatform.system} "default" { };

      user = mkOption {
        type = str;
        default = "clickrtraining";
        description = "User account under which the bot runs.";
      };

      group = mkOption {
        type = str;
        default = "clickrtraining";
        description = "Group account under which the bot runs.";
      };

      address = mkOption {
        type = str;
        default = "0.0.0.0";
        description = "The address to listen on.";
      };

      port = mkOption {
        type = number;
        default = 8098;
        description = "The port to listen on.";
      };

      metricsToken = mkOption {
        type = str;
        default = null;
        description = "The token to use to access metrics. Enables the metrics endpoint.";
      };
    };

    config = mkIf cfg.enable {
      systemd.services = {
        clickrtraining = {
          description = "Clickrtraining";
          after = [ "network.target" ];
          wantedBy = [ "multi-user.target" ];
          restartTriggers = [
            cfg.package
            cfg.address
            cfg.port
          ];

          serviceConfig = {
            Type = "simple";
            User = cfg.user;
            Group = cfg.group;
            WorkingDirectory = cfg.package;
            ExecStart = "${cfg.package}/bin/clickrtraining host --addr ${cfg.address} --port ${toString cfg.port}" 
              + (if cfg.metricsToken == null then "" else " --metrics-token '${cfg.metricsToken}'");
            Restart = "always";
          };
        };
      };

      users.users = optionalAttrs (cfg.user == "clickrtraining") {
        clickrtraining = {
          isSystemUser = true;
          group = cfg.group;
        };
      };

      users.groups = optionalAttrs (cfg.group == "clickrtraining") {
        clickrtraining = { };
      };
    };
  }
)