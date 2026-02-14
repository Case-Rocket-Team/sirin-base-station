use serde::Serialize;
use sirin_shared::{packet::{OutPacket, RadioPacket}, song::{FromSong, SongSize, ToSong}, state::NominalState};
use tauri::{AppHandle, Listener, ipc::Channel};
use futures_util::StreamExt;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum LoraConnMsg {
    SocketConnected,
    Error(String),
    SocketClosed,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoraPacketRx {
    packet: serde_json::Value
}

#[tauri::command]
async fn listen_to_lora(
    app: AppHandle,
    on_lora_conn_msg: Channel<LoraConnMsg>,
    on_packet: Channel<LoraPacketRx>
) {
    let (mut stream, response) = match connect_async("ws://localhost:8765").await {
        Ok(ws) => ws,
        Err(e) => {
            on_lora_conn_msg.send(LoraConnMsg::Error(e.to_string())).unwrap();
            return;
        }
    };

    let _ = on_lora_conn_msg.send(LoraConnMsg::SocketConnected);

    loop {
        let Some(next) = stream.next().await else {
            break;
        };

        let msg = match next {
            Ok(msg) => msg,
            Err(e) => {
                on_lora_conn_msg.send(LoraConnMsg::Error(e.to_string())).unwrap();
                continue;
            }
        };

        let Message::Binary(data) = msg else {
            continue;
        };

        let packet = RadioPacket::<OutPacket>::from_song(&data).unwrap();
        let _ = on_packet.send(LoraPacketRx {
            packet: serde_json::to_value(packet).unwrap()
        });
    }

    let _ = on_lora_conn_msg.send(LoraConnMsg::SocketClosed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![listen_to_lora])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}