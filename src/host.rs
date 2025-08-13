use std::{
    collections::HashMap,
    hash::{DefaultHasher, Hash, Hasher},
    net::IpAddr,
    time::Duration,
};

use actix_files::Files;
use actix_web::{
    get,
    web::{self, Payload},
    App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use actix_ws::Session;
use anyhow::{anyhow, Context, Result};
use log::info;
use once_cell::sync::Lazy;
use rand::{rngs::StdRng, seq::IndexedRandom, SeedableRng};
use random_word::Lang;
use tokio::{
    spawn,
    sync::Mutex,
    time::{sleep, timeout},
};

use crate::ServerArgs;

static CLIENTS: Lazy<Mutex<HashMap<String, Vec<Client>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static WORDS: Lazy<&'static [&'static str]> =
    Lazy::new(|| random_word::all_len(8, Lang::En).unwrap());

struct Client {
    session: Session,
    word: &'static str,
}

#[get("/api/{id}/listen")]
async fn listen(
    req: HttpRequest,
    stream: Payload,
    id: web::Path<String>,
) -> Result<HttpResponse, actix_web::Error> {
    if id.len() > 64 {
        return Ok(HttpResponse::BadRequest().finish());
    }

    let (res, session, _stream) = actix_ws::handle(&req, stream)?;
    let word = get_word(&req);

    CLIENTS
        .lock()
        .await
        .entry(id.to_string())
        .or_default()
        .push(Client { session, word });

    info!("'{word}' has connected to room '{id}'.");

    Ok(res)
}

#[get("/api/{id}/click")]
async fn click(req: HttpRequest, id: web::Path<String>) -> impl Responder {
    if id.len() > 64 {
        return HttpResponse::BadRequest().finish();
    }

    if let Some(sessions) = CLIENTS.lock().await.get_mut(&id.to_string()) {
        send_or_drop(sessions, "c").await;

        info!("'{}' clicked room '{id}'", get_word(&req));

        HttpResponse::Ok().finish()
    } else {
        HttpResponse::NotFound().finish()
    }
}

#[get("/api/{id}/custom/{name}")]
async fn custom_sound(req: HttpRequest, path: web::Path<(String, String)>) -> impl Responder {
    if path.0.len() > 64 || path.1.len() > 64 {
        return HttpResponse::BadRequest().finish();
    }

    if let Some(sessions) = CLIENTS.lock().await.get_mut(&path.0.to_string()) {
        let sound = format!("s/{}", path.1.replace("/", "_"));
        send_or_drop(sessions, &sound).await;

        info!(
            "'{}' triggered custom sound '{}' in room '{}'",
            get_word(&req),
            path.1,
            path.0,
        );

        HttpResponse::Ok().finish()
    } else {
        HttpResponse::NotFound().finish()
    }
}

pub async fn start(args: ServerArgs) -> Result<()> {
    spawn(heartbeat());

    let server = HttpServer::new(|| {
        App::new()
            .service(listen)
            .service(click)
            .service(custom_sound)
            .service(Files::new("/", "./static").index_file("index.html"))
    })
    .bind((args.addr, args.port))
    .context("Failed to bind address")?;

    info!("Server configured, running...");
    server
        .run()
        .await
        .map_err(|e| anyhow!("Failed to run server: {}", e))
}

async fn heartbeat() {
    loop {
        sleep(Duration::from_secs(10)).await;

        let mut clients = CLIENTS.lock().await;

        for (_, sessions) in clients.iter_mut() {
            send_or_drop(sessions, "h").await;
        }

        clients.retain(|_, v| !v.is_empty());
    }
}

async fn send_or_drop(clients: &mut Vec<Client>, msg: &str) {
    let mut do_retain = Vec::new();

    for client in clients.iter_mut() {
        match timeout(Duration::from_millis(500), client.session.text(msg)).await {
            Ok(_) => {
                do_retain.push(true);
            }
            //TODO: this seems to be the cause of the random disconnects
            // Ok(Err(e)) => {
            //     info!("A client has disconnected: {e}");
            //     do_retain.push(false);
            // }
            Err(e) => {
                info!("'{}' has timed out: {e}", client.word);
                do_retain.push(false);
            }
        }
    }

    clients.retain(|_| do_retain.pop().unwrap());
}

fn get_word(req: &HttpRequest) -> &'static str {
    let address = match req.headers().get("X-Forwarded-For") {
        Some(address) => String::from(address.to_str().unwrap_or("")),
        None => req
            .peer_addr()
            .map::<String, _>(|a| match a.ip() {
                IpAddr::V4(ip) => ip.to_string(),
                IpAddr::V6(ip) => ip.to_string(),
            })
            .unwrap_or("".to_string()),
    };

    let mut seed = DefaultHasher::new();
    address.hash(&mut seed);

    WORDS
        .choose(&mut StdRng::seed_from_u64(seed.finish()))
        .unwrap()
}
