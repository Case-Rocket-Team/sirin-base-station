use serde::Serialize;
use sirin_shared::{packet::{OutPacket, RadioPacket}, song::{FromSong, SongSize, ToSong}, state::NominalState};
use tauri::{AppHandle, Listener, ipc::Channel, Manager, Emitter};
use futures_util::StreamExt;
use tokio_tungstenite::{connect_async, tungstenite::{connect, protocol::Message}};
use std::process::Command;

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
    app: tauri::AppHandle,
    on_lora_conn_msg: tauri::ipc::Channel<LoraConnMsg>,
    on_packet: tauri::ipc::Channel<LoraPacketRx>,
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
            packet: serde_json::to_value(packet.clone()).unwrap()
        });

        app.emit("lora-packet", LoraPacketRx {packet: serde_json::to_value(packet).unwrap()}).unwrap();
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

pub fn run_lora_demod() {
    Command::new("python3") // or "python" on Windows
        .arg("../lora_demod/lora_demod.sh")
        .spawn()
        .expect("Failed to start lora_demod.sh");
}

#[tauri::command]
async fn check_hackrf() -> bool {
    return match connect_async("ws://localhost:8765").await{
        Ok(_ws) => true,
        Err(_e) => false
    }
}