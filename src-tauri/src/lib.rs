use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sirin_shared::packet::{InPacket, OutPacket, RadioPacket, MAX_OUT_PACKET_SIZE};
use sirin_shared::song::{FromSong, SongSize, ToSong};
use sirin_shared::usb::{USB_EP_IN_ADDR, USB_EP_OUT_ADDR, USB_PID, USB_VID};
use std::fs::{create_dir_all, read_to_string, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

const LORA_PACKET_EVENT: &str = "telemetry://lora/packet";
const USB_PACKET_EVENT: &str = "telemetry://usb/packet";
const REPLAY_PACKET_EVENT: &str = "telemetry://replay/packet";
const LORA_STATUS_EVENT: &str = "telemetry://lora/status";
const USB_STATUS_EVENT: &str = "telemetry://usb/status";
const TIMELINE_EVENT: &str = "telemetry://timeline/state";
const REPLAY_STATUS_EVENT: &str = "telemetry://replay/status";
const DEMOD_STATUS_EVENT: &str = "telemetry://demod/status";

const DEFAULT_LORA_URL: &str = "ws://localhost:8765";
const DEFAULT_EXPECTED_PPS: f64 = 10.0;
const DEFAULT_STALE_TIMEOUT_MS: u64 = 3_000;
const DEFAULT_ALTITUDE_MIN_FT: f64 = 0.0;
const DEFAULT_ALTITUDE_MAX_FT: f64 = 40_000.0;
const DEFAULT_TARGET_ALTITUDE_FT: f64 = 30_000.0;
const DEFAULT_RECORDING_FORMAT: RecordingFormat = RecordingFormat::Jsonl;
const CONFIG_FILE_NAME: &str = "base-station-config.json";
const SIRIN_DEMOD_RELATIVE_PATH: &str = "lora_demod/sirin_demod.py";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    lora_websocket_url: String,
    expected_packets_per_second: f64,
    stale_timeout_ms: u64,
    target_altitude_ft: f64,
    altitude_min_ft: f64,
    altitude_max_ft: f64,
    recording_directory: String,
    default_recording_format: RecordingFormat,
    lora_demod_path: String,
    lora_demod_host: String,
    lora_demod_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            lora_websocket_url: DEFAULT_LORA_URL.to_string(),
            expected_packets_per_second: DEFAULT_EXPECTED_PPS,
            stale_timeout_ms: DEFAULT_STALE_TIMEOUT_MS,
            target_altitude_ft: DEFAULT_TARGET_ALTITUDE_FT,
            altitude_min_ft: DEFAULT_ALTITUDE_MIN_FT,
            altitude_max_ft: DEFAULT_ALTITUDE_MAX_FT,
            recording_directory: "recordings".to_string(),
            default_recording_format: DEFAULT_RECORDING_FORMAT,
            lora_demod_path: SIRIN_DEMOD_RELATIVE_PATH.to_string(),
            lora_demod_host: "127.0.0.1".to_string(),
            lora_demod_port: 8765,
        }
    }
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
enum RecordingFormat {
    Csv,
    #[default]
    Jsonl,
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum TelemetrySource {
    Lora,
    Usb,
    Replay,
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum LinkState {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum TimelineStage {
    Standby,
    Launch,
    Burnout,
    Apogee,
    Drogue,
    Main,
    Landed,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkStatus {
    source: TelemetrySource,
    state: LinkState,
    message: Option<String>,
    connected: bool,
    device_detected: bool,
    packet_count: u64,
    rejected_packet_count: u64,
    dropped_packet_count: u64,
    packets_per_second: f64,
    last_packet_at_ms: Option<u64>,
    first_packet_at_ms: Option<u64>,
    updated_at_ms: u64,
}

impl LinkStatus {
    fn new(source: TelemetrySource) -> Self {
        Self {
            source,
            state: LinkState::Disconnected,
            message: None,
            connected: false,
            device_detected: false,
            packet_count: 0,
            rejected_packet_count: 0,
            dropped_packet_count: 0,
            packets_per_second: 0.0,
            last_packet_at_ms: None,
            first_packet_at_ms: None,
            updated_at_ms: now_ms(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PacketFields {
    flight_mode: Option<String>,
    altitude_agl_ft: Option<f64>,
    expected_apogee_ft: Option<f64>,
    speed_mps: Option<f64>,
    accel_total_g: Option<f64>,
    gps_satellite_count: Option<u64>,
    latitude_deg: Option<f64>,
    longitude_deg: Option<f64>,
    position_x_m: Option<f64>,
    position_y_m: Option<f64>,
    position_z_m: Option<f64>,
    quat_w: Option<f64>,
    quat_x: Option<f64>,
    quat_y: Option<f64>,
    quat_z: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SirinPacket {
    source: TelemetrySource,
    received_at_ms: u64,
    sequence: u64,
    callsign: Option<String>,
    valid: bool,
    raw: Value,
    fields: PacketFields,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineState {
    current_stage: TimelineStage,
    stage_started_at_ms: u64,
    completed_stages: Vec<TimelineStage>,
    last_update_ms: u64,
    message: String,
}

impl Default for TimelineState {
    fn default() -> Self {
        Self {
            current_stage: TimelineStage::Standby,
            stage_started_at_ms: now_ms(),
            completed_stages: Vec::new(),
            last_update_ms: now_ms(),
            message: "Awaiting launch conditions".into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecordingStatus {
    active: bool,
    source: Option<TelemetrySource>,
    format: Option<RecordingFormat>,
    filename: Option<String>,
    path: Option<String>,
    packets_written: u64,
    started_at_ms: Option<u64>,
    last_error: Option<String>,
}

impl Default for RecordingStatus {
    fn default() -> Self {
        Self {
            active: false,
            source: None,
            format: None,
            filename: None,
            path: None,
            packets_written: 0,
            started_at_ms: None,
            last_error: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReplayStatus {
    loaded: bool,
    playing: bool,
    source_path: Option<String>,
    packet_count: usize,
    current_index: usize,
    speed: f64,
    current_timestamp_ms: Option<u64>,
    last_error: Option<String>,
}

impl Default for ReplayStatus {
    fn default() -> Self {
        Self {
            loaded: false,
            playing: false,
            source_path: None,
            packet_count: 0,
            current_index: 0,
            speed: 1.0,
            current_timestamp_ms: None,
            last_error: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DemodStatus {
    running: bool,
    path: String,
    host: String,
    port: u16,
    last_error: Option<String>,
}

impl DemodStatus {
    fn from_config(config: &AppConfig) -> Self {
        Self {
            running: false,
            path: config.lora_demod_path.clone(),
            host: config.lora_demod_host.clone(),
            port: config.lora_demod_port,
            last_error: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsbDeviceInfo {
    vendor_id: u16,
    product_id: u16,
    bus_number: u8,
    address: u8,
    is_sirin: bool,
    description: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsbCommandRequest {
    command: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartRecordingRequest {
    source: TelemetrySource,
    filename: String,
    format: RecordingFormat,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadReplayRequest {
    path: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartReplayRequest {
    speed: f64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TelemetrySnapshot {
    lora_status: LinkStatus,
    usb_status: LinkStatus,
    latest_lora_packet: Option<SirinPacket>,
    latest_usb_packet: Option<SirinPacket>,
    latest_replay_packet: Option<SirinPacket>,
    config: AppConfig,
    recording_status: RecordingStatus,
    timeline_state: TimelineState,
    replay_status: ReplayStatus,
    demod_status: DemodStatus,
}

struct RecordingState {
    file: Option<File>,
    status: RecordingStatus,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            file: None,
            status: RecordingStatus::default(),
        }
    }
}

struct ReplayManager {
    packets: Vec<SirinPacket>,
    status: ReplayStatus,
}

impl Default for ReplayManager {
    fn default() -> Self {
        Self {
            packets: Vec::new(),
            status: ReplayStatus::default(),
        }
    }
}

struct DemodManager {
    child: Option<Child>,
    status: DemodStatus,
}

struct TelemetryState {
    config: Arc<RwLock<AppConfig>>,
    lora_status: Arc<RwLock<LinkStatus>>,
    usb_status: Arc<RwLock<LinkStatus>>,
    latest_lora_packet: Arc<RwLock<Option<SirinPacket>>>,
    latest_usb_packet: Arc<RwLock<Option<SirinPacket>>>,
    latest_replay_packet: Arc<RwLock<Option<SirinPacket>>>,
    recording: Arc<Mutex<RecordingState>>,
    timeline: Arc<RwLock<TimelineState>>,
    replay: Arc<Mutex<ReplayManager>>,
    demod: Arc<Mutex<DemodManager>>,
}

impl TelemetryState {
    fn new(config: AppConfig) -> Self {
        let demod_status = DemodStatus::from_config(&config);
        Self {
            config: Arc::new(RwLock::new(config)),
            lora_status: Arc::new(RwLock::new(LinkStatus::new(TelemetrySource::Lora))),
            usb_status: Arc::new(RwLock::new(LinkStatus::new(TelemetrySource::Usb))),
            latest_lora_packet: Arc::new(RwLock::new(None)),
            latest_usb_packet: Arc::new(RwLock::new(None)),
            latest_replay_packet: Arc::new(RwLock::new(None)),
            recording: Arc::new(Mutex::new(RecordingState::default())),
            timeline: Arc::new(RwLock::new(TimelineState::default())),
            replay: Arc::new(Mutex::new(ReplayManager::default())),
            demod: Arc::new(Mutex::new(DemodManager {
                child: None,
                status: demod_status,
            })),
        }
    }
}

#[tauri::command]
async fn get_telemetry_snapshot(state: State<'_, TelemetryState>) -> Result<TelemetrySnapshot, String> {
    Ok(TelemetrySnapshot {
        lora_status: state.lora_status.read().await.clone(),
        usb_status: state.usb_status.read().await.clone(),
        latest_lora_packet: state.latest_lora_packet.read().await.clone(),
        latest_usb_packet: state.latest_usb_packet.read().await.clone(),
        latest_replay_packet: state.latest_replay_packet.read().await.clone(),
        config: state.config.read().await.clone(),
        recording_status: state.recording.lock().await.status.clone(),
        timeline_state: state.timeline.read().await.clone(),
        replay_status: state.replay.lock().await.status.clone(),
        demod_status: state.demod.lock().await.status.clone(),
    })
}

#[tauri::command]
async fn get_config(state: State<'_, TelemetryState>) -> Result<AppConfig, String> {
    Ok(state.config.read().await.clone())
}

#[tauri::command]
async fn update_config(state: State<'_, TelemetryState>, config_patch: AppConfig) -> Result<AppConfig, String> {
    validate_config(&config_patch)?;
    save_config_to_disk(&config_patch)?;
    {
        *state.config.write().await = config_patch.clone();
    }
    {
        let mut demod = state.demod.lock().await;
        demod.status.path = config_patch.lora_demod_path.clone();
        demod.status.host = config_patch.lora_demod_host.clone();
        demod.status.port = config_patch.lora_demod_port;
    }
    Ok(config_patch)
}

#[tauri::command]
async fn get_recording_status(state: State<'_, TelemetryState>) -> Result<RecordingStatus, String> {
    Ok(state.recording.lock().await.status.clone())
}

#[tauri::command]
async fn get_usb_devices() -> Result<Vec<UsbDeviceInfo>, String> {
    rusb::devices()
        .map_err(|err| err.to_string())?
        .iter()
        .map(|device| {
            let descriptor = device.device_descriptor().map_err(|err| err.to_string())?;
            Ok(UsbDeviceInfo {
                vendor_id: descriptor.vendor_id(),
                product_id: descriptor.product_id(),
                bus_number: device.bus_number(),
                address: device.address(),
                is_sirin: descriptor.vendor_id() == USB_VID && descriptor.product_id() == USB_PID,
                description: format!(
                    "VID {:04x} PID {:04x} bus {} addr {}",
                    descriptor.vendor_id(),
                    descriptor.product_id(),
                    device.bus_number(),
                    device.address()
                ),
            })
        })
        .collect()
}

#[tauri::command]
async fn connect_usb(state: State<'_, TelemetryState>, device_id: String) -> Result<String, String> {
    let mut status = state.usb_status.write().await;
    status.message = Some(format!("USB auto-connect requested for {device_id}"));
    status.updated_at_ms = now_ms();
    Ok(device_id)
}

#[tauri::command]
async fn disconnect_usb(state: State<'_, TelemetryState>) -> Result<String, String> {
    let mut status = state.usb_status.write().await;
    status.connected = false;
    status.state = LinkState::Disconnected;
    status.message = Some("USB disconnect requested".into());
    status.updated_at_ms = now_ms();
    Ok("USB disconnect requested".into())
}

#[tauri::command]
async fn send_usb_command(state: State<'_, TelemetryState>, request: UsbCommandRequest) -> Result<String, String> {
    let command = request.command.trim().to_ascii_lowercase();
    let packet = match command.as_str() {
        "tail_on" | "tail(true)" | "start_stream" => InPacket::Tail(true),
        "tail_off" | "tail(false)" | "stop_stream" => InPacket::Tail(false),
        _ => return Err("Supported USB commands are tail_on and tail_off".into()),
    };
    send_usb_control_packet(packet)?;
    let mut status = state.usb_status.write().await;
    status.message = Some(format!("USB command sent: {command}"));
    status.updated_at_ms = now_ms();
    Ok(format!("Sent {command}"))
}

#[tauri::command]
async fn get_demod_status(state: State<'_, TelemetryState>) -> Result<DemodStatus, String> {
    Ok(state.demod.lock().await.status.clone())
}

#[tauri::command]
async fn start_lora_demod(app: AppHandle, state: State<'_, TelemetryState>) -> Result<DemodStatus, String> {
    let config = state.config.read().await.clone();
    let mut demod = state.demod.lock().await;
    if let Some(child) = demod.child.as_mut() {
        match child.try_wait() {
            Ok(None) => {
                demod.status.running = true;
                return Ok(demod.status.clone());
            }
            Ok(Some(_)) | Err(_) => {
                demod.child = None;
                demod.status.running = false;
            }
        }
    }
    let script_path = resolve_workspace_path(&config.lora_demod_path);
    if !script_path.exists() {
        demod.status.last_error = Some(format!("Demod script not found at {}", script_path.display()));
        let _ = app.emit(DEMOD_STATUS_EVENT, &demod.status);
        return Err(demod.status.last_error.clone().unwrap_or_default());
    }

    let mut command = Command::new("python");
    command
        .arg(script_path)
        .arg("--host")
        .arg(&config.lora_demod_host)
        .arg("--port")
        .arg(config.lora_demod_port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    match command.spawn() {
        Ok(child) => {
            demod.child = Some(child);
            demod.status.running = true;
            demod.status.last_error = None;
        }
        Err(err) => {
            demod.status.running = false;
            demod.status.last_error = Some(err.to_string());
        }
    }
    let _ = app.emit(DEMOD_STATUS_EVENT, &demod.status);
    Ok(demod.status.clone())
}

#[tauri::command]
async fn stop_lora_demod(app: AppHandle, state: State<'_, TelemetryState>) -> Result<DemodStatus, String> {
    let mut demod = state.demod.lock().await;
    if let Some(child) = demod.child.as_mut() {
        let _ = child.kill();
    }
    demod.child = None;
    demod.status.running = false;
    let _ = app.emit(DEMOD_STATUS_EVENT, &demod.status);
    Ok(demod.status.clone())
}

#[tauri::command]
async fn load_replay_file(app: AppHandle, state: State<'_, TelemetryState>, request: LoadReplayRequest) -> Result<ReplayStatus, String> {
    let path = request.path.trim();
    if path.is_empty() {
        return Err("Replay path cannot be empty".into());
    }
    let content = read_to_string(path).map_err(|err| err.to_string())?;
    let packets = if path.to_ascii_lowercase().ends_with(".jsonl") {
        parse_jsonl_replay(&content)?
    } else if path.to_ascii_lowercase().ends_with(".csv") {
        parse_csv_replay(&content)
    } else {
        return Err("Replay file must be .jsonl or .csv".into());
    };
    let mut replay = state.replay.lock().await;
    replay.packets = packets;
    replay.status = ReplayStatus {
        loaded: true,
        playing: false,
        source_path: Some(path.to_string()),
        packet_count: replay.packets.len(),
        current_index: 0,
        speed: 1.0,
        current_timestamp_ms: replay.packets.first().map(|packet| packet.received_at_ms),
        last_error: None,
    };
    let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
    Ok(replay.status.clone())
}

#[tauri::command]
async fn start_replay(app: AppHandle, state: State<'_, TelemetryState>, request: StartReplayRequest) -> Result<ReplayStatus, String> {
    let speed = if request.speed > 0.0 { request.speed } else { 1.0 };
    {
        let mut replay = state.replay.lock().await;
        if !replay.status.loaded {
            return Err("No replay file loaded".into());
        }
        replay.status.playing = true;
        replay.status.speed = speed;
        let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
    }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        run_replay_loop(handle).await;
    });
    Ok(state.replay.lock().await.status.clone())
}

#[tauri::command]
async fn pause_replay(app: AppHandle, state: State<'_, TelemetryState>) -> Result<ReplayStatus, String> {
    let mut replay = state.replay.lock().await;
    replay.status.playing = false;
    let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
    Ok(replay.status.clone())
}

#[tauri::command]
async fn step_replay(app: AppHandle, state: State<'_, TelemetryState>) -> Result<ReplayStatus, String> {
    emit_next_replay_packet(&app, &state).await?;
    Ok(state.replay.lock().await.status.clone())
}

#[tauri::command]
async fn stop_replay(app: AppHandle, state: State<'_, TelemetryState>) -> Result<ReplayStatus, String> {
    let mut replay = state.replay.lock().await;
    replay.status.playing = false;
    replay.status.current_index = 0;
    replay.status.current_timestamp_ms = replay.packets.first().map(|packet| packet.received_at_ms);
    *state.latest_replay_packet.write().await = None;
    let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
    Ok(replay.status.clone())
}

#[tauri::command]
async fn check_usb() -> Result<bool, String> {
    detect_usb_device()
}

#[tauri::command]
async fn check_hackrf(state: State<'_, TelemetryState>) -> Result<bool, String> {
    let url = state.config.read().await.lora_websocket_url.clone();
    Ok(connect_async(url).await.is_ok())
}

#[tauri::command]
async fn start_recording(state: State<'_, TelemetryState>, request: StartRecordingRequest) -> Result<RecordingStatus, String> {
    let safe_name = sanitize_filename(&request.filename)?;
    let config = state.config.read().await.clone();
    let directory = resolve_workspace_path(&config.recording_directory);
    create_dir_all(&directory).map_err(|err| err.to_string())?;
    let extension = match request.format {
        RecordingFormat::Csv => "csv",
        RecordingFormat::Jsonl => "jsonl",
    };
    let path = directory.join(format!("{safe_name}.{extension}"));
    let mut file = File::create(&path).map_err(|err| err.to_string())?;
    if matches!(request.format, RecordingFormat::Csv) {
        writeln!(
            file,
            "received_at_ms,source,callsign,flight_mode,altitude_agl_ft,expected_apogee_ft,speed_mps,accel_total_g,gps_satellite_count,latitude_deg,longitude_deg,position_x_m,position_y_m,position_z_m,quat_w,quat_x,quat_y,quat_z"
        )
        .map_err(|err| err.to_string())?;
    }
    let mut recording = state.recording.lock().await;
    recording.file = Some(file);
    recording.status = RecordingStatus {
        active: true,
        source: Some(request.source),
        format: Some(request.format),
        filename: Some(safe_name),
        path: Some(path.to_string_lossy().to_string()),
        packets_written: 0,
        started_at_ms: Some(now_ms()),
        last_error: None,
    };
    Ok(recording.status.clone())
}

#[tauri::command]
async fn stop_recording(state: State<'_, TelemetryState>) -> Result<RecordingStatus, String> {
    let mut recording = state.recording.lock().await;
    recording.file = None;
    recording.status.active = false;
    recording.status.source = None;
    recording.status.format = None;
    recording.status.started_at_ms = None;
    Ok(recording.status.clone())
}

fn validate_config(config: &AppConfig) -> Result<(), String> {
    if config.expected_packets_per_second <= 0.0 {
        return Err("Expected packets per second must be greater than zero".into());
    }
    if config.stale_timeout_ms == 0 {
        return Err("Stale timeout must be greater than zero".into());
    }
    if config.altitude_max_ft <= config.altitude_min_ft {
        return Err("Maximum altitude must be greater than minimum altitude".into());
    }
    if config.lora_demod_port == 0 {
        return Err("LoRa demod port must be greater than zero".into());
    }
    Ok(())
}

fn sanitize_filename(filename: &str) -> Result<String, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("Recording filename cannot be empty".into());
    }
    let sanitized: String = trimmed
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        .collect();
    if sanitized.is_empty() {
        return Err("Recording filename contains no valid characters".into());
    }
    Ok(sanitized)
}

fn save_config_to_disk(config: &AppConfig) -> Result<(), String> {
    let path = workspace_config_path();
    let serialized = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    std::fs::write(path, serialized).map_err(|err| err.to_string())
}

fn load_config_from_disk() -> AppConfig {
    let path = workspace_config_path();
    if let Ok(text) = read_to_string(path) {
        if let Ok(config) = serde_json::from_str::<AppConfig>(&text) {
            return config;
        }
    }
    AppConfig::default()
}

fn workspace_config_path() -> PathBuf {
    PathBuf::from(CONFIG_FILE_NAME)
}

fn resolve_workspace_path(path: &str) -> PathBuf {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        candidate
    } else {
        PathBuf::from(".").join(candidate)
    }
}

fn send_usb_control_packet(packet: InPacket) -> Result<(), String> {
    let devices = rusb::devices().map_err(|err| err.to_string())?;
    let device = devices
        .iter()
        .find(|device| {
            device
                .device_descriptor()
                .map(|desc| desc.vendor_id() == USB_VID && desc.product_id() == USB_PID)
                .unwrap_or(false)
        })
        .ok_or_else(|| "No Sirin USB device found".to_string())?;
    let handle = device.open().map_err(|err| err.to_string())?;
    let _ = handle.detach_kernel_driver(0);
    handle.claim_interface(0).map_err(|err| err.to_string())?;
    let mut cmd_buf = [0u8; MAX_OUT_PACKET_SIZE];
    packet.to_song(&mut cmd_buf).map_err(|err| format!("{err:?}"))?;
    handle
        .write_bulk(USB_EP_OUT_ADDR, &cmd_buf[..packet.song_size()], Duration::from_secs(5))
        .map_err(|err| err.to_string())?;
    let _ = handle.release_interface(0);
    Ok(())
}

async fn spawn_services(app: &AppHandle) {
    let lora_app = app.clone();
    tauri::async_runtime::spawn(async move {
        run_lora_listener(lora_app).await;
    });
    let usb_app = app.clone();
    tauri::async_runtime::spawn(async move {
        run_usb_listener(usb_app).await;
    });
}

async fn run_lora_listener(app: AppHandle) {
    loop {
        let Some(state) = app.try_state::<TelemetryState>() else { return; };
        update_status(&app, &state, TelemetrySource::Lora, LinkState::Connecting, Some("Connecting to LoRa websocket".into()), false).await;
        let url = state.config.read().await.lora_websocket_url.clone();
        match connect_async(&url).await {
            Ok((mut stream, _)) => {
                update_status(&app, &state, TelemetrySource::Lora, LinkState::Connected, Some(format!("Connected to {url}")), true).await;
                while let Some(next) = stream.next().await {
                    match next {
                        Ok(Message::Binary(data)) => {
                            if let Some(packet) = parse_lora_packet(data.to_vec()) {
                                handle_packet(&app, &state, packet).await;
                            } else {
                                mark_rejected(&app, &state, TelemetrySource::Lora, "Rejected corrupt LoRa packet").await;
                            }
                        }
                        Ok(_) => {}
                        Err(err) => {
                            update_status(&app, &state, TelemetrySource::Lora, LinkState::Error, Some(format!("LoRa socket error: {err}")), false).await;
                            break;
                        }
                    }
                }
            }
            Err(err) => {
                update_status(&app, &state, TelemetrySource::Lora, LinkState::Error, Some(format!("Unable to reach LoRa websocket: {err}")), false).await;
            }
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

async fn run_usb_listener(app: AppHandle) {
    loop {
        let Some(state) = app.try_state::<TelemetryState>() else { return; };
        let connected = detect_usb_device().unwrap_or(false);
        update_status(
            &app,
            &state,
            TelemetrySource::Usb,
            if connected { LinkState::Connecting } else { LinkState::Disconnected },
            Some(if connected { "USB device detected".into() } else { "No Sirin USB device detected".into() }),
            false,
        )
        .await;
        if !connected {
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }
        let app_for_blocking = app.clone();
        let result = tokio::task::spawn_blocking(move || read_usb_session(app_for_blocking)).await;
        if let Err(err) = result {
            update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("USB task join error: {err}")), false).await;
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

fn read_usb_session(app: AppHandle) {
    let Some(state) = app.try_state::<TelemetryState>() else { return; };
    let devices = match rusb::devices() {
        Ok(devices) => devices,
        Err(err) => {
            tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("Unable to enumerate USB devices: {err}")), false));
            return;
        }
    };
    let Some(device) = devices.iter().find(|device| {
        device.device_descriptor().map(|desc| desc.vendor_id() == USB_VID && desc.product_id() == USB_PID).unwrap_or(false)
    }) else {
        tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Disconnected, Some("Sirin USB device is no longer present".into()), false));
        return;
    };
    let handle = match device.open() {
        Ok(handle) => handle,
        Err(err) => {
            tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("Failed to open USB device: {err}")), false));
            return;
        }
    };
    let _ = handle.detach_kernel_driver(0);
    if let Err(err) = handle.claim_interface(0) {
        tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("Failed to claim USB interface: {err}")), false));
        return;
    }
    let tail_packet = InPacket::Tail(true);
    let mut cmd_buf = [0u8; MAX_OUT_PACKET_SIZE];
    if let Err(err) = tail_packet.to_song(&mut cmd_buf) {
        let _ = handle.release_interface(0);
        tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("Failed to encode Tail command: {err:?}")), false));
        return;
    }
    if let Err(err) = handle.write_bulk(USB_EP_OUT_ADDR, &cmd_buf[..tail_packet.song_size()], Duration::from_secs(5)) {
        let _ = handle.release_interface(0);
        tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("Failed to start USB telemetry stream: {err}")), false));
        return;
    }
    tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Connected, Some("Streaming USB telemetry".into()), true));
    let mut buf = vec![0u8; MAX_OUT_PACKET_SIZE * 128 * 8];
    loop {
        let len = match handle.read_bulk(USB_EP_IN_ADDR, &mut buf, Duration::from_millis(250)) {
            Ok(len) => len,
            Err(rusb::Error::Timeout) => continue,
            Err(rusb::Error::NoDevice) => {
                let _ = handle.release_interface(0);
                tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Disconnected, Some("USB device disconnected".into()), false));
                return;
            }
            Err(err) => {
                let _ = handle.release_interface(0);
                tauri::async_runtime::block_on(update_status(&app, &state, TelemetrySource::Usb, LinkState::Error, Some(format!("USB read error: {err}")), false));
                return;
            }
        };
        if len == 0 {
            continue;
        }
        match OutPacket::from_song(&buf[..len]) {
            Ok(packet) => {
                let raw = serde_json::json!({
                    "id": 0,
                    "callsign": [],
                    "packet": serde_json::to_value(&packet).unwrap_or(Value::Null)
                });
                tauri::async_runtime::block_on(handle_packet(&app, &state, normalize_packet(TelemetrySource::Usb, raw, true)));
            }
            Err(_) => {
                tauri::async_runtime::block_on(mark_rejected(&app, &state, TelemetrySource::Usb, "Rejected corrupt USB packet"));
            }
        }
    }
}

async fn run_replay_loop(app: AppHandle) {
    loop {
        let Some(state) = app.try_state::<TelemetryState>() else { return; };
        let (playing, speed) = {
            let replay = state.replay.lock().await;
            (replay.status.playing, replay.status.speed)
        };
        if !playing {
            return;
        }
        if emit_next_replay_packet(&app, &state).await.is_err() {
            let mut replay = state.replay.lock().await;
            replay.status.playing = false;
            let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
            return;
        }
        let sleep_ms = (1000.0 / speed.max(0.25)) as u64;
        tokio::time::sleep(Duration::from_millis(sleep_ms)).await;
    }
}

async fn emit_next_replay_packet(app: &AppHandle, state: &TelemetryState) -> Result<(), String> {
    let packet = {
        let mut replay = state.replay.lock().await;
        if !replay.status.loaded {
            return Err("No replay loaded".into());
        }
        if replay.status.current_index >= replay.packets.len() {
            replay.status.playing = false;
            let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
            return Err("Replay complete".into());
        }
        let packet = replay.packets[replay.status.current_index].clone();
        replay.status.current_index += 1;
        replay.status.current_timestamp_ms = Some(packet.received_at_ms);
        let _ = app.emit(REPLAY_STATUS_EVENT, &replay.status);
        packet
    };
    *state.latest_replay_packet.write().await = Some(packet.clone());
    update_timeline(app, state, &packet).await;
    let _ = app.emit(REPLAY_PACKET_EVENT, &packet);
    Ok(())
}

fn parse_lora_packet(data: Vec<u8>) -> Option<SirinPacket> {
    let packet = RadioPacket::<OutPacket>::from_song(&data).ok()?;
    let raw = serde_json::to_value(packet).ok()?;
    Some(normalize_packet(TelemetrySource::Lora, raw, true))
}

async fn handle_packet(app: &AppHandle, state: &TelemetryState, packet: SirinPacket) {
    {
        let mut recording = state.recording.lock().await;
        let should_record = recording.status.active && recording.status.source == Some(packet.source);
        if should_record {
            let format = recording.status.format.unwrap_or(RecordingFormat::Jsonl);
            let write_result = if let Some(file) = recording.file.as_mut() {
                write_packet_record(file, format, &packet)
            } else {
                Err("Recording file handle missing".into())
            };
            match write_result {
                Ok(()) => {
                    recording.status.packets_written += 1;
                    recording.status.last_error = None;
                }
                Err(err) => recording.status.last_error = Some(err),
            }
        }
    }

    match packet.source {
        TelemetrySource::Lora => *state.latest_lora_packet.write().await = Some(packet.clone()),
        TelemetrySource::Usb => *state.latest_usb_packet.write().await = Some(packet.clone()),
        TelemetrySource::Replay => *state.latest_replay_packet.write().await = Some(packet.clone()),
    }

    update_timeline(app, state, &packet).await;

    let (event_name, status_lock) = match packet.source {
        TelemetrySource::Lora => (LORA_PACKET_EVENT, &state.lora_status),
        TelemetrySource::Usb => (USB_PACKET_EVENT, &state.usb_status),
        TelemetrySource::Replay => (REPLAY_PACKET_EVENT, &state.lora_status),
    };

    if packet.source != TelemetrySource::Replay {
        let mut status = status_lock.write().await;
        status.packet_count += 1;
        status.last_packet_at_ms = Some(packet.received_at_ms);
        status.first_packet_at_ms = status.first_packet_at_ms.or(Some(packet.received_at_ms));
        status.updated_at_ms = now_ms();
        status.connected = true;
        status.device_detected = true;
        status.state = LinkState::Connected;
        status.packets_per_second = calculate_packets_per_second(status.packet_count, status.first_packet_at_ms, status.last_packet_at_ms);
    }

    let _ = app.emit(event_name, &packet);
    if packet.source != TelemetrySource::Replay {
        emit_status(app, status_lock, if packet.source == TelemetrySource::Lora { LORA_STATUS_EVENT } else { USB_STATUS_EVENT }).await;
    }
}

async fn update_timeline(app: &AppHandle, state: &TelemetryState, packet: &SirinPacket) {
    let mut timeline = state.timeline.write().await;
    let next = next_timeline_stage(&timeline, packet);
    if next != timeline.current_stage {
        if !timeline.completed_stages.contains(&timeline.current_stage) {
            timeline.completed_stages.push(timeline.current_stage);
        }
        timeline.current_stage = next;
        timeline.stage_started_at_ms = packet.received_at_ms;
    }
    timeline.last_update_ms = packet.received_at_ms;
    timeline.message = timeline_message(next).to_string();
    let _ = app.emit(TIMELINE_EVENT, &*timeline);
}

fn next_timeline_stage(current: &TimelineState, packet: &SirinPacket) -> TimelineStage {
    let fields = &packet.fields;
    let accel = fields.accel_total_g.unwrap_or(0.0);
    let altitude = fields.altitude_agl_ft.unwrap_or(0.0);
    let speed = fields.speed_mps.unwrap_or(0.0);
    let mode = fields.flight_mode.as_deref().unwrap_or("").to_ascii_lowercase();
    match current.current_stage {
        TimelineStage::Standby if mode.contains("flight") || accel >= 2.5 || altitude > 75.0 => TimelineStage::Launch,
        TimelineStage::Launch if accel < 1.2 && altitude > 250.0 => TimelineStage::Burnout,
        TimelineStage::Burnout if speed < 0.0 || altitude >= fields.expected_apogee_ft.unwrap_or(60_000.0) * 0.95 => TimelineStage::Apogee,
        TimelineStage::Apogee if speed < -8.0 => TimelineStage::Drogue,
        TimelineStage::Drogue if altitude < 5000.0 && speed.abs() < 35.0 => TimelineStage::Main,
        TimelineStage::Main if altitude < 100.0 && speed.abs() < 3.0 => TimelineStage::Landed,
        stage => stage,
    }
}

fn timeline_message(stage: TimelineStage) -> &'static str {
    match stage {
        TimelineStage::Standby => "Awaiting launch conditions",
        TimelineStage::Launch => "Launch detected",
        TimelineStage::Burnout => "Motor burnout inferred",
        TimelineStage::Apogee => "Apogee inferred",
        TimelineStage::Drogue => "Drogue descent phase",
        TimelineStage::Main => "Main descent phase",
        TimelineStage::Landed => "Landing inferred",
    }
}

fn write_packet_record(file: &mut File, format: RecordingFormat, packet: &SirinPacket) -> Result<(), String> {
    match format {
        RecordingFormat::Jsonl => {
            let line = serde_json::to_string(packet).map_err(|err| err.to_string())?;
            writeln!(file, "{line}").map_err(|err| err.to_string())
        }
        RecordingFormat::Csv => writeln!(
            file,
            "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
            packet.received_at_ms,
            format_source(packet.source),
            csv_cell(packet.callsign.as_deref()),
            csv_cell(packet.fields.flight_mode.as_deref()),
            csv_number(packet.fields.altitude_agl_ft),
            csv_number(packet.fields.expected_apogee_ft),
            csv_number(packet.fields.speed_mps),
            csv_number(packet.fields.accel_total_g),
            csv_u64(packet.fields.gps_satellite_count),
            csv_number(packet.fields.latitude_deg),
            csv_number(packet.fields.longitude_deg),
            csv_number(packet.fields.position_x_m),
            csv_number(packet.fields.position_y_m),
            csv_number(packet.fields.position_z_m),
            csv_number(packet.fields.quat_w),
            csv_number(packet.fields.quat_x),
            csv_number(packet.fields.quat_y),
            csv_number(packet.fields.quat_z),
        )
        .map_err(|err| err.to_string()),
    }
}

async fn mark_rejected(app: &AppHandle, state: &TelemetryState, source: TelemetrySource, message: &str) {
    let status_lock = match source {
        TelemetrySource::Lora => &state.lora_status,
        TelemetrySource::Usb => &state.usb_status,
        TelemetrySource::Replay => return,
    };
    {
        let mut status = status_lock.write().await;
        status.rejected_packet_count += 1;
        status.updated_at_ms = now_ms();
        status.message = Some(message.to_string());
    }
    emit_status(app, status_lock, if source == TelemetrySource::Lora { LORA_STATUS_EVENT } else { USB_STATUS_EVENT }).await;
}

async fn update_status(app: &AppHandle, state: &TelemetryState, source: TelemetrySource, link_state: LinkState, message: Option<String>, connected: bool) {
    let status_lock = match source {
        TelemetrySource::Lora => &state.lora_status,
        TelemetrySource::Usb => &state.usb_status,
        TelemetrySource::Replay => return,
    };
    {
        let mut status = status_lock.write().await;
        status.state = link_state;
        status.message = message;
        status.connected = connected;
        status.updated_at_ms = now_ms();
        status.device_detected = match source {
            TelemetrySource::Lora => connected || matches!(link_state, LinkState::Connecting),
            TelemetrySource::Usb => detect_usb_device().unwrap_or(false),
            TelemetrySource::Replay => false,
        };
    }
    emit_status(app, status_lock, if source == TelemetrySource::Lora { LORA_STATUS_EVENT } else { USB_STATUS_EVENT }).await;
}

async fn emit_status(app: &AppHandle, status_lock: &RwLock<LinkStatus>, event_name: &str) {
    let _ = app.emit(event_name, &status_lock.read().await.clone());
}

fn detect_usb_device() -> Result<bool, String> {
    rusb::devices().map_err(|err| err.to_string()).map(|list| {
        list.iter().any(|device| {
            device.device_descriptor().map(|desc| desc.vendor_id() == USB_VID && desc.product_id() == USB_PID).unwrap_or(false)
        })
    })
}

fn normalize_packet(source: TelemetrySource, raw: Value, valid: bool) -> SirinPacket {
    let fields = PacketFields {
        flight_mode: find_string(&raw, &["flight_mode", "mode", "nominal_state"]),
        altitude_agl_ft: find_number(&raw, &["altitude_agl_ft", "altitude_ft", "agl_ft"]),
        expected_apogee_ft: find_number(&raw, &["expected_apogee_ft", "apogee_ft"]),
        speed_mps: find_number(&raw, &["speed_mps", "velocity_mps", "vertical_speed_mps"]),
        accel_total_g: find_number(&raw, &["accel_total_g", "acceleration_g", "accel_g"]),
        gps_satellite_count: find_u64(&raw, &["gps_satellite_count", "num_satellites", "satellites"]),
        latitude_deg: find_number(&raw, &["latitude_deg", "latitude"]),
        longitude_deg: find_number(&raw, &["longitude_deg", "longitude"]),
        position_x_m: find_number(&raw, &["position_x_m", "x_m", "x"]),
        position_y_m: find_number(&raw, &["position_y_m", "y_m", "y"]),
        position_z_m: find_number(&raw, &["position_z_m", "z_m", "z"]),
        quat_w: find_number(&raw, &["quat_w", "qw", "w"]),
        quat_x: find_number(&raw, &["quat_x", "qx"]),
        quat_y: find_number(&raw, &["quat_y", "qy"]),
        quat_z: find_number(&raw, &["quat_z", "qz"]),
    };
    SirinPacket {
        source,
        received_at_ms: now_ms(),
        sequence: now_ms(),
        callsign: extract_callsign(&raw),
        valid,
        raw,
        fields,
    }
}

fn parse_jsonl_replay(content: &str) -> Result<Vec<SirinPacket>, String> {
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let mut packet = serde_json::from_str::<SirinPacket>(line).map_err(|err| err.to_string())?;
            packet.source = TelemetrySource::Replay;
            Ok(packet)
        })
        .collect()
}

fn parse_csv_replay(content: &str) -> Vec<SirinPacket> {
    content
        .lines()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() < 18 {
                return None;
            }
            Some(SirinPacket {
                source: TelemetrySource::Replay,
                received_at_ms: parts[0].parse().ok().unwrap_or_else(now_ms),
                sequence: parts[0].parse().ok().unwrap_or_else(now_ms),
                callsign: non_empty(parts[2]),
                valid: true,
                raw: serde_json::json!({ "csv": line }),
                fields: PacketFields {
                    flight_mode: non_empty(parts[3]),
                    altitude_agl_ft: parse_opt_f64(parts[4]),
                    expected_apogee_ft: parse_opt_f64(parts[5]),
                    speed_mps: parse_opt_f64(parts[6]),
                    accel_total_g: parse_opt_f64(parts[7]),
                    gps_satellite_count: parts[8].parse().ok(),
                    latitude_deg: parse_opt_f64(parts[9]),
                    longitude_deg: parse_opt_f64(parts[10]),
                    position_x_m: parse_opt_f64(parts[11]),
                    position_y_m: parse_opt_f64(parts[12]),
                    position_z_m: parse_opt_f64(parts[13]),
                    quat_w: parse_opt_f64(parts[14]),
                    quat_x: parse_opt_f64(parts[15]),
                    quat_y: parse_opt_f64(parts[16]),
                    quat_z: parse_opt_f64(parts[17]),
                },
            })
        })
        .collect()
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
}

fn parse_opt_f64(value: &str) -> Option<f64> {
    value.trim().parse().ok()
}

fn extract_callsign(value: &Value) -> Option<String> {
    if let Some(text) = find_string(value, &["callsign"]) {
        return Some(text);
    }
    let callsign = value.get("callsign")?;
    if let Value::Array(bytes) = callsign {
        let chars: String = bytes.iter().filter_map(|item| item.as_u64().and_then(|byte| char::from_u32(byte as u32))).collect();
        let trimmed = chars.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    None
}

fn find_number(value: &Value, keys: &[&str]) -> Option<f64> {
    find_value(value, keys)?.as_f64()
}

fn find_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    find_value(value, keys)?.as_u64()
}

fn find_string(value: &Value, keys: &[&str]) -> Option<String> {
    let found = find_value(value, keys)?;
    let text = found.as_str()?;
    let trimmed = text.trim();
    if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
}

fn find_value<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            for key in keys {
                if let Some(found) = map.get(*key) {
                    return Some(found);
                }
            }
            for nested in map.values() {
                if let Some(found) = find_value(nested, keys) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_value(item, keys)),
        _ => None,
    }
}

fn calculate_packets_per_second(packet_count: u64, first_packet_at_ms: Option<u64>, last_packet_at_ms: Option<u64>) -> f64 {
    let Some(first) = first_packet_at_ms else { return 0.0; };
    let Some(last) = last_packet_at_ms else { return 0.0; };
    if packet_count < 2 || last <= first {
        return packet_count as f64;
    }
    let elapsed_seconds = (last - first) as f64 / 1000.0;
    if elapsed_seconds <= 0.0 { packet_count as f64 } else { packet_count as f64 / elapsed_seconds }
}

fn format_source(source: TelemetrySource) -> &'static str {
    match source {
        TelemetrySource::Lora => "lora",
        TelemetrySource::Usb => "usb",
        TelemetrySource::Replay => "replay",
    }
}

fn csv_cell(value: Option<&str>) -> String {
    value.unwrap_or("").replace(',', " ")
}

fn csv_number(value: Option<f64>) -> String {
    value.map(|number| number.to_string()).unwrap_or_default()
}

fn csv_u64(value: Option<u64>) -> String {
    value.map(|number| number.to_string()).unwrap_or_default()
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config_from_disk();
    tauri::Builder::default()
        .manage(TelemetryState::new(config))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                spawn_services(&handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_telemetry_snapshot,
            get_config,
            update_config,
            get_recording_status,
            get_usb_devices,
            connect_usb,
            disconnect_usb,
            send_usb_command,
            get_demod_status,
            start_lora_demod,
            stop_lora_demod,
            check_usb,
            check_hackrf,
            start_recording,
            stop_recording,
            load_replay_file,
            start_replay,
            pause_replay,
            step_replay,
            stop_replay
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_filename_removes_invalid_characters() {
        assert_eq!(sanitize_filename(" launch:?01 ").unwrap(), "launch01");
    }

    #[test]
    fn timeline_progresses_forward() {
        let timeline = TimelineState::default();
        let packet = SirinPacket {
            source: TelemetrySource::Lora,
            received_at_ms: 1,
            sequence: 1,
            callsign: None,
            valid: true,
            raw: Value::Null,
            fields: PacketFields {
                flight_mode: Some("Flight".into()),
                altitude_agl_ft: Some(120.0),
                expected_apogee_ft: Some(1000.0),
                speed_mps: Some(50.0),
                accel_total_g: Some(3.0),
                ..PacketFields::default()
            },
        };
        assert_eq!(next_timeline_stage(&timeline, &packet), TimelineStage::Launch);
    }

    #[test]
    fn jsonl_replay_parser_reads_packet() {
        let sample = r#"{"source":"replay","receivedAtMs":1,"sequence":1,"callsign":null,"valid":true,"raw":null,"fields":{"flightMode":"Standby","altitudeAglFt":1.0,"expectedApogeeFt":2.0,"speedMps":3.0,"accelTotalG":4.0,"gpsSatelliteCount":5,"latitudeDeg":6.0,"longitudeDeg":7.0,"positionXM":8.0,"positionYM":9.0,"positionZM":10.0,"quatW":1.0,"quatX":0.0,"quatY":0.0,"quatZ":0.0}}"#;
        let parsed = parse_jsonl_replay(sample).unwrap();
        assert_eq!(parsed.len(), 1);
    }
}
