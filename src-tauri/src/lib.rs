use serde::Serialize;
use sirin_shared::{song::{FromSong, SongSize, ToSong}, state::NominalState};
use tauri::Listener;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message, accept_async};

/// Converts a Song-serialized byte buffer to JSON string
fn song_to_json<T: FromSong + Serialize>(buf: &[u8]) -> Result<String, String> {
    let value = T::from_song(buf).map_err(|e| format!("Failed to deserialize: {:?}", e))?;
    serde_json::to_string(&value).map_err(|e| format!("Failed to serialize to JSON: {:?}", e))
}

fn state_to_json(state: &NominalState) -> Result<String, String> {
    let size = state.song_size();
    let mut buf = vec![0u8; size];
    state.to_song(&mut buf).map_err(|e| format!("Failed to serialize: {:?}", e))?;
    song_to_json::<NominalState>(&buf)
}

async fn run_websocket_server() {
    let listener = TcpListener::bind("127.0.0.1:9001").await.expect("Failed to bind WebSocket server");
    println!("WebSocket server listening on ws://127.0.0.1:9001");

    // Create a broadcast channel for sending state updates to all clients
    let (tx, _) = broadcast::channel::<String>(16);
    let tx = Arc::new(tx);

    // Spawn the state update loop
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        const SIRIN_URL: &str = "ws://localhost:9002/sirin_packet_endpoint";

        loop {
            match connect_async(SIRIN_URL).await {
                Ok((mut ws, _)) => {
                    println!("Connected to sirin feed at {SIRIN_URL}");

                    while let Some(msg) = ws.next().await {
                        match msg {
                            Ok(Message::Binary(payload)) => match song_to_json::<NominalState>(&payload) {
                                Ok(json) => {
                                    println!("{json}");
                                    let _ = tx_clone.send(json);
                                }
                                Err(e) => eprintln!("Failed to parse sirin packet: {e}"),
                            },
                            Ok(Message::Text(text)) => println!("{text}"),
                            Ok(_) => eprintln!("Unexpected packet type from sirin websocket"),
                            Err(e) => {
                                eprintln!("Sirin websocket error: {e}");
                                break;
                            }
                        }
                    }

                    eprintln!("Sirin websocket closed, retrying in 1s");
                }
                Err(e) => eprintln!("Failed to connect to sirin feed: {e}"),
            }

            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    });

    // Accept new connections
    while let Ok((stream, addr)) = listener.accept().await {
        println!("New WebSocket connection from: {}", addr);
        let mut rx = tx.subscribe();
        
        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    eprintln!("WebSocket handshake failed: {}", e);
                    return;
                }
            };

            let (mut write, _read) = ws_stream.split();

            // Listen for broadcast messages and forward to this client
            loop {
                match rx.recv().await {
                    Ok(json) => {
                        use tokio_tungstenite::tungstenite::Message;
                        if let Err(_) = write.send(Message::Text(json.into())).await {
                            // Client disconnected
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        // Client is too slow, skip missed messages
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
            
            println!("Client {} disconnected", addr);
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Spawn WebSocket server in a separate thread with its own tokio runtime
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(run_websocket_server());
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
