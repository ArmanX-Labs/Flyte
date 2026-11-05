#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod vfs;
mod sync;
mod provider;
mod server;
mod session;
pub mod config;

use dotenvy::dotenv;
use std::env;
use std::sync::Arc;
use tauri::State;
use vfs::node::Node;
use session::SessionManager;
use provider::telegram::TelegramProvider;
use vfs::filesystem::FileSystem;
use sync::engine::SyncEngine;

pub struct AppState {
    pub sessions: SessionManager,
    pub api_id: i32,
    pub api_hash: String,
}

#[tauri::command]
async fn auth_status(token: String, state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(state.sessions.get_session(&token).await.is_some())
}

#[tauri::command]
async fn auth_send_code(phone: String, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let mut provider = TelegramProvider::new(state.api_id, state.api_hash.clone());
    let session_file = crate::config::get_session_path(&phone);
    let session_file_str = session_file.to_string_lossy().to_string();
    provider.init(&session_file_str).await.map_err(|e| e.to_string())?;

    if provider.is_authorized().await.unwrap_or(false) {
        let db_file = crate::config::get_db_path(&phone);
        let fs = FileSystem::new_with_db(&db_file).map_err(|e| e.to_string())?;
        let sync_engine = SyncEngine::new(provider);
        
        let user_session = Arc::new(crate::session::UserSession {
            fs: std::sync::Mutex::new(fs),
            sync_engine,
        });
        
        let session_token = uuid::Uuid::new_v4().to_string();
        state.sessions.add_session(phone.clone(), session_token.clone(), user_session).await;
        
        return Ok(serde_json::json!({ "token": session_token }));
    }

    let token = provider.request_login_code(&phone).await.map_err(|e| e.to_string())?;
    
    let auth_state = crate::session::AuthState {
        login_token: Some(token),
        password_token: None,
        provider,
        phone: phone.clone(),
    };
    
    state.sessions.save_auth(phone, auth_state).await;
    Ok(serde_json::json!({ "requires_code": true }))
}

#[tauri::command]
async fn auth_sign_in(phone: String, code: String, state: State<'_, Arc<AppState>>) -> Result<Option<String>, String> {
    let mut auth_state = state.sessions.get_auth(&phone).await.ok_or_else(|| "No login session".to_string())?;
    let token = auth_state.login_token.take().ok_or_else(|| "No login session started".to_string())?;
    
    match auth_state.provider.sign_in(&token, &code).await {
        Ok(Some(password_token)) => {
            auth_state.password_token = Some(password_token);
            state.sessions.save_auth(phone, auth_state).await;
            Ok(None) // Needs password
        }
        Ok(None) => {
            let db_file = crate::config::get_db_path(&phone);
            let fs = FileSystem::new_with_db(&db_file).map_err(|e| e.to_string())?;
            let sync_engine = SyncEngine::new(auth_state.provider);
            
            let user_session = Arc::new(crate::session::UserSession {
                fs: std::sync::Mutex::new(fs),
                sync_engine,
            });
            
            let session_token = uuid::Uuid::new_v4().to_string();
            state.sessions.add_session(phone.clone(), session_token.clone(), user_session).await;
            
            Ok(Some(session_token))
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn auth_check_password(phone: String, password: String, state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let mut auth_state = state.sessions.get_auth(&phone).await.ok_or_else(|| "No login session".to_string())?;
    let token = auth_state.password_token.take().ok_or_else(|| "No password session started".to_string())?;
    
    auth_state.provider.check_password(token, &password).await.map_err(|e| e.to_string())?;
            
    let db_file = crate::config::get_db_path(&phone);
    let fs = FileSystem::new_with_db(&db_file).map_err(|e| e.to_string())?;
    let sync_engine = SyncEngine::new(auth_state.provider);
    
    let user_session = Arc::new(crate::session::UserSession {
        fs: std::sync::Mutex::new(fs),
        sync_engine,
    });
    
    let session_token = uuid::Uuid::new_v4().to_string();
    state.sessions.add_session(phone.clone(), session_token.clone(), user_session).await;
    
    Ok(session_token)
}

#[tauri::command]
async fn list_directory(token: String, path: String, state: State<'_, Arc<AppState>>) -> Result<Vec<Node>, String> {
    let session = state.sessions.get_session(&token).await.ok_or("Not logged in")?;
    let fs = session.fs.lock().unwrap();
    fs.list(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_folder(token: String, path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let session = state.sessions.get_session(&token).await.ok_or("Not logged in")?;
    let mut fs = session.fs.lock().unwrap();
    fs.mkdir(&path).map_err(|e| e.to_string()).map(|_| ())
}

#[tauri::command]
async fn delete_item(token: String, path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let session = state.sessions.get_session(&token).await.ok_or("Not logged in")?;
    let mut fs = session.fs.lock().unwrap();
    fs.delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn upload_physical_file(token: String, source_path: String, file_name: String, parent_path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let session = state.sessions.get_session(&token).await.ok_or("Not logged in")?;
    
    // 1. Read local file
    let data = tokio::fs::read(&source_path).await.map_err(|e| e.to_string())?;
    
    // 2. Write to VFS
    let node = {
        let mut fs = session.fs.lock().unwrap();
        
        let vfs_path = if parent_path == "/" {
            format!("/{}", file_name)
        } else {
            format!("{}/{}", parent_path, file_name)
        };
        
        let _ = fs.create_file(&vfs_path);
        fs.write(&vfs_path, &data)?;
        
        let id = fs.resolve_path(&vfs_path)?;
        fs.db().get_node(&id).map_err(|e| e.to_string())?.ok_or_else(|| "Node not found".to_string())?
    };
    
    // 3. Upload to Telegram
    let remote_id = session.sync_engine.process_upload(&node).await?;
    
    // 4. Mark synced
    {
        let fs = session.fs.lock().unwrap();
        fs.db().mark_file_as_synced(&node.id, &remote_id, node.size, &node.hash).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn open_file(token: String, id: String, name: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let session = state.sessions.get_session(&token).await.ok_or("Not logged in")?;
    
    let cache_path = crate::config::get_cache_path(&id);
    if !cache_path.exists() {
        let node_uuid = uuid::Uuid::parse_str(&id).map_err(|e| e.to_string())?;
        
        let remote_id = {
            let fs = session.fs.lock().unwrap();
            fs.db().get_remote_id(&node_uuid)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "File is not synced to cloud yet!".to_string())?
        };
        
        println!("Downloading file {} from Telegram (ID: {})", name, remote_id);
        let cache_path_str = cache_path.to_string_lossy().to_string();
        session.sync_engine.download_to_file(&remote_id, &cache_path_str).await?;
    }
    
    // Copy to a temporary file with the correct extension
    let temp_dir = std::env::temp_dir().join("flyte_preview");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    
    let temp_file_path = temp_dir.join(format!("{}_{}", id, name));
    std::fs::copy(&cache_path, &temp_file_path).map_err(|e| e.to_string())?;
    
    let path_str = temp_file_path.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path_str).spawn().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path_str).spawn().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd").args(["/C", "start", "", &path_str]).spawn().map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    dotenv().ok();

    // Read credentials from environment/.env, or fallback to default client credentials
    let api_id: i32 = env::var("TELEGRAM_API_ID")
        .ok()
        .and_then(|v| v.parse().ok())
        .or_else(|| option_env!("DEFAULT_TELEGRAM_API_ID").and_then(|v| v.parse().ok()))
        .unwrap_or(32346266);

    let api_hash: String = env::var("TELEGRAM_API_HASH")
        .ok()
        .filter(|v| !v.is_empty())
        .or_else(|| option_env!("DEFAULT_TELEGRAM_API_HASH").map(String::from))
        .unwrap_or_else(|| "6d60d23fdd12f5b55d74f970ef6f3687".to_string());

    if api_id == 0 || api_hash.is_empty() {
        eprintln!("ERROR: Please set TELEGRAM_API_ID and TELEGRAM_API_HASH.");
        return;
    }

    config::init_directories().unwrap_or_else(|e| {
        println!("Warning: Failed to initialize data directories: {}", e);
    });

    let rt = tokio::runtime::Runtime::new().unwrap();
    let _guard = rt.enter();

    let state = Arc::new(AppState {
        sessions: SessionManager::new(api_id, api_hash.clone()),
        api_id,
        api_hash,
    });

    let server_state = state.clone();
    
    // If SERVER_ONLY is set, we run the Axum server directly and block forever
    if env::var("SERVER_ONLY").is_ok() {
        println!("Starting in SERVER_ONLY mode (Headless)");
        rt.block_on(async move {
            server::start_server(server_state).await;
            std::future::pending::<()>().await;
        });
        return;
    }

    // Otherwise, start server in background and run Tauri GUI
    rt.spawn(async move {
        server::start_server(server_state).await;
    });

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            list_directory, 
            create_folder, 
            delete_item, 
            upload_physical_file, 
            open_file,
            auth_status,
            auth_send_code,
            auth_sign_in,
            auth_check_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
