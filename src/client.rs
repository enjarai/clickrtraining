use core::str;
#[cfg(feature = "audio")]
use std::{fs::File, io::Cursor, path::PathBuf};
use std::{time::Duration};

use anyhow::Result;
use awc::ws::Frame::Text;
use futures::StreamExt;
use log::{info, warn};
#[cfg(feature = "audio")]
use rodio::Decoder;
use tokio::time::{sleep, timeout};

use crate::{build_room_url, ClientArgs};

pub async fn start(args: ClientArgs) -> Result<()> {
    let client = awc::Client::builder()
        .max_http_version(awc::http::Version::HTTP_11)
        .finish();

    let sounds_directory = shellexpand::tilde(&args.sounds_directory);
    std::fs::create_dir_all(sounds_directory.as_ref())?;

    let mut url = build_room_url(
        args.protocol.as_str(),
        args.addr.as_str(),
        args.port,
        args.id.as_str(),
    );
    url.add_route("listen");
    let url = url.build();

    loop {
        match client
            .ws(&url)
            .connect()
            .await
        {
            Ok((res, mut ws)) => {
                info!("Connected! HTTP response: {res:?}");

                #[cfg(feature = "audio")]
                {
                    let (_stream, stream_handle) = rodio::OutputStream::try_default()?;
                    let sink = rodio::Sink::try_new(&stream_handle)?;
                    sink.set_volume(args.volume);
                }

                loop {
                    match timeout(Duration::from_secs(20), ws.next()).await {
                        Ok(Some(msg)) => {
                            if let Ok(Text(msg)) = msg {
                                match str::from_utf8(&msg) {
                                    Ok("c") => {
                                        info!("Click!");

                                        #[cfg(feature = "audio")]
                                        {
                                            let (_stream, _stream_handle) =
                                                rodio::OutputStream::try_default()?;
                                            let source = Decoder::new(Cursor::new(include_bytes!(
                                                "../static/sound.ogg"
                                            )))?;

                                            sink.append(source);
                                            sink.sleep_until_end();
                                        }
                                    }
                                    Ok(s) => {
                                        let parts: Vec<&str> = s.split("/").collect();

                                        match parts.as_slice() {
                                            ["s", sound_name] => {
                                                info!("Playing custom sound! '{}'", sound_name);

                                                #[cfg(feature = "audio")]
                                                {
                                                    let mut path =
                                                        PathBuf::from(sounds_directory.as_ref());
                                                    path.push(sound_name.replace(".", ""));
                                                    path.set_extension("ogg");

                                                    if let Ok(file) = File::open(&path) {
                                                        let source = Decoder::new(file)?;

                                                        sink.append(source);
                                                        // sink.sleep_until_end();
                                                    } else {
                                                        info!("Could not find file: {}", path.to_str().unwrap_or("?"));
                                                    }
                                                }
                                            }
                                            _ => {
                                                if args.verbose {
                                                    info!("Ba-bump");
                                                }
                                            }
                                        }
                                    }
                                    _ => {
                                        if args.verbose {
                                            info!("Ba-bump");
                                        }
                                    }
                                }
                            }
                        }
                        Ok(None) => {
                            warn!("Got disconnected! Attempting to reconnect in 5 seconds.");
                            sleep(Duration::from_secs(5)).await;
                            break;
                        }
                        Err(_) => {
                            warn!("Timed out! Attempting to reconnect in 5 seconds.");
                            sleep(Duration::from_secs(5)).await;
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                warn!("Failed to connect to websocket: {e}");
                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
