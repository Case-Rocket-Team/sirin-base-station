use serde::Serialize;
use sirin_shared::{packet::{OutPacket, RadioPacket, InPacket}, song::{FromSong, SongSize, ToSong}, state::NominalState};
use sirin_shared::usb::{USB_EP_IN_ADDR, USB_EP_OUT_ADDR, USB_PID, USB_VID};
use sirin_shared::packet::MAX_OUT_PACKET_SIZE;
use tauri::{AppHandle, Listener, ipc::Channel};
use futures_util::StreamExt;
use tokio_tungstenite::{connect_async, tungstenite::{connect, protocol::Message}};
use std::process::Command;
use std::time::Duration;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum LoraConnMsg {
    SocketConnected,
    Error(String),
    SocketClosed,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum UsbConnMsg {
    Connected,
    Error(String),
    Disconnected,
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

#[tauri::command]
async fn listen_to_usb(
    on_usb_conn_msg: Channel<UsbConnMsg>,
    on_packet: Channel<LoraPacketRx>
) {
    tokio::task::spawn_blocking(move || {
        // Find the Sirin device
        let device = rusb::devices()
            .unwrap()
            .iter()
            .find(|d| {
                let desc = d.device_descriptor().unwrap();
                desc.vendor_id() == USB_VID && desc.product_id() == USB_PID
            });

        let device = match device {
            Some(d) => d,
            None => {
                let _ = on_usb_conn_msg.send(UsbConnMsg::Error("No Sirin USB device found".into()));
                return;
            }
        };

        let handle = match device.open() {
            Ok(h) => h,
            Err(e) => {
                let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("Failed to open USB: {}", e)));
                return;
            }
        };

        // Force detach kernel driver regardless of whether it reports active
        let _ = handle.detach_kernel_driver(0);

        if let Err(e) = handle.claim_interface(0) {
            let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("Failed to claim interface: {}", e)));
            return;
        }

        let _ = on_usb_conn_msg.send(UsbConnMsg::Connected);

        // Send Tail(true) to tell Sirin to start streaming — same as CLI
        let tail_packet = InPacket::Tail(true);
        let mut cmd_buf = [0u8; MAX_OUT_PACKET_SIZE];
        if let Err(e) = tail_packet.to_song(&mut cmd_buf) {
            let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("Failed to encode Tail command: {:?}", e)));
            return;
        }
        if let Err(e) = handle.write_bulk(
            USB_EP_OUT_ADDR,
            &cmd_buf[0..tail_packet.song_size()],
            Duration::from_secs(5)
        ) {
            let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("Failed to send Tail command: {}", e)));
            return;
        }

        // Match CLI buffer size and timeout exactly
        let mut buf = vec![0u8; MAX_OUT_PACKET_SIZE * 128 * 100];

        loop {
            let len = match handle.read_bulk(USB_EP_IN_ADDR, &mut buf, Duration::from_secs(0)) {
                Ok(len) => len,
                Err(rusb::Error::Timeout) => continue,
                Err(rusb::Error::NoDevice) => {
                    let _ = on_usb_conn_msg.send(UsbConnMsg::Disconnected);
                    break;
                }
                Err(e) => {
                    let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("USB read error: {}", e)));
                    break;
                }
            };

            let packet = match OutPacket::from_song(&buf[0..len]) {
                Ok(p) => p,
                Err(e) => {
                    let _ = on_usb_conn_msg.send(UsbConnMsg::Error(format!("Decode error: {:?}", e)));
                    continue;
                }
            };

            let value = serde_json::json!({
                "id": 0,
                "callsign": [],
                "packet": serde_json::to_value(&packet).unwrap()
            });

            let _ = on_packet.send(LoraPacketRx { packet: value });
        }
    }).await.ok();
}

#[tauri::command]
async fn check_hackrf() -> bool {
    match connect_async("ws://localhost:8765").await {
        Ok(_ws) => true,
        Err(_e) => false
    }
}

#[tauri::command]
async fn check_usb() -> bool {
    rusb::devices()
        .map(|list| list.iter().any(|d| {
            let desc = d.device_descriptor().unwrap();
            desc.vendor_id() == USB_VID && desc.product_id() == USB_PID
        }))
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_lora_demod();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            listen_to_lora,
            listen_to_usb,
            check_hackrf,
            check_usb
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run_lora_demod() {
    let _ = Command::new("sh")
        .arg("-c")
        .arg("cd ../lora_demod && ./lora_demod.sh")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
}