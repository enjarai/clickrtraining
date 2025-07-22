use anyhow::{anyhow, Result};
use clap::{arg, command, Parser, Subcommand};
use env_logger::Target;
use log::LevelFilter;
use url_builder::URLBuilder;

mod host;
mod client;

#[derive(Debug, Parser)]
#[command(name = "clickrtraining")]
#[command(about = "Host and client for clickrtraining", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Host(ServerArgs),
    Listen(ClientArgs),
    Click(ClickArgs),
}

#[derive(clap::Args, Debug, Clone)]
#[command(about = "Host a clickrtraining instance", long_about = None)]
struct ServerArgs {
    #[arg(short, long, help = "Whenever or not to enable verbose output")]
    verbose: bool,
    #[arg(short, long, help = "The address to listen on")]
    addr: String,
    #[arg(short, long, default_value_t = 443, help = "The port to listen on")]
    port: u16,
}

#[derive(clap::Args, Debug, Clone)]
#[command(about = "Listen for clicks in a room", long_about = None)]
struct ClientArgs {
    #[arg(short, long, help = "Whenever or not to enable verbose output")]
    verbose: bool,
    #[arg(long, default_value = "wss", help = "The protocol to use when connecting to the host")]
    protocol: String,
    #[arg(short, long, default_value = "clickertrain.ing", help = "The host address")]
    addr: String,
    #[arg(short, long, default_value_t = 443, help = "The host port")]
    port: u16,
    #[arg(short, long, help = "The room identifier")]
    id: String,
    #[arg(short, long, default_value_t = 1.0, help = "The volume at which to play the clicks")]
    volume: f32,
    #[arg(short, long, default_value = "~/.config/clickrtraining/sounds/", help = "A directory holding custom sound files, all ending in .ogg")]
    sounds_directory: String,
}

#[derive(clap::Args, Debug, Clone)]
#[command(about = "Click a room", long_about = None)]
struct ClickArgs {
    #[arg(short, long, help = "Whenever or not to enable verbose output")]
    verbose: bool,
    #[arg(long, default_value = "https", help = "The protocol to use when connecting to the host")]
    protocol: String,
    #[arg(short, long, default_value = "clickertrain.ing", help = "The host address")]
    addr: String,
    #[arg(short, long, default_value_t = 443, help = "The host port")]
    port: u16,
    #[arg(short, long, help = "The room identifier")]
    id: String,
    #[arg(short, long, help = "A custom sound to play instead of clicking")]
    sound: Option<String>,
}

#[actix_web::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_default_env()
        .target(Target::Stdout)
        .filter_level(LevelFilter::Info)
        .init();

    match Cli::parse().command {
        Command::Host(args) => host::start(args).await,
        Command::Listen(args) => client::start(args).await,
        Command::Click(args) => {
            let client = awc::Client::default();

            let mut url = build_room_url(args.protocol.as_str(), args.addr.as_str(), args.port, args.id.as_str());
            match args.sound {
                Some(sound) => url
                    .add_route("custom")
                    .add_route(&sound.replace("/", "_")),
                None => url.add_route("click"),
            };

            println!("{:?}", url);

            client.get(url.build())
                .send()
                .await
                .map(|_e| ())
                .map_err(|e| anyhow!("Failed to ping room: {}", e))
        },
    }
}

fn build_room_url(protocol: &str, address: &str, port: u16, room_id: &str) -> URLBuilder {
    let mut ub = URLBuilder::new();

    ub
        .set_protocol(protocol)
        .set_host(address)
        .set_port(port)
        .add_route("api")
        .add_route(room_id);
    
    ub
}
