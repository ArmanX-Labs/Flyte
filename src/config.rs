use std::env;
use std::fs;
use std::path::PathBuf;

/// Returns the base data directory where SQLite databases,
/// sessions, and caches are stored.
/// Defaults to "data", but can be configured via DATA_DIR environment variable.
pub fn get_data_dir() -> PathBuf {
    if let Ok(dir) = env::var("DATA_DIR") {
        PathBuf::from(dir)
    } else if let Some(base_data) = tauri::api::path::data_dir() {
        base_data.join("com.flyte.app")
    } else {
        PathBuf::from("data")
    }
}

/// Returns the directory used for caching uploaded and downloaded files.
pub fn get_cache_dir() -> PathBuf {
    get_data_dir().join("cache")
}

/// Returns the SQLite database file path for a given phone number.
pub fn get_db_path(phone: &str) -> PathBuf {
    get_data_dir().join(format!("db_{}.sqlite", phone))
}

/// Returns the Telegram MTProto session file path for a given phone number.
pub fn get_session_path(phone: &str) -> PathBuf {
    get_data_dir().join(format!("session_{}.session", phone))
}

/// Returns the path to the JSON file storing active session tokens.
pub fn get_sessions_json_path() -> PathBuf {
    get_data_dir().join("sessions.json")
}

/// Returns the local cache path for a specific file node UUID.
pub fn get_cache_path(node_id: &str) -> PathBuf {
    get_cache_dir().join(node_id)
}

/// Returns the path to the built frontend assets.
/// Defaults to "frontend/dist", configurable via FRONTEND_DIST.
pub fn get_frontend_dist_dir() -> String {
    env::var("FRONTEND_DIST").unwrap_or_else(|_| "frontend/dist".to_string())
}

/// Initializes necessary storage directories on startup.
pub fn init_directories() -> std::io::Result<()> {
    fs::create_dir_all(get_data_dir())?;
    fs::create_dir_all(get_cache_dir())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derived_paths() {
        let db = get_db_path("+1234567890");
        assert!(db.to_string_lossy().ends_with("db_+1234567890.sqlite"));

        let session = get_session_path("+1234567890");
        assert!(session.to_string_lossy().ends_with("session_+1234567890.session"));

        let cache = get_cache_path("some-uuid");
        assert!(cache.to_string_lossy().ends_with("some-uuid"));
    }
}
