use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn set_mobile_pin_cmd(state: State<'_, DbState>, pin: String) -> Result<String, String> {
    state.lock().map_err(|e| e.to_string())?.set_mobile_token(&pin)
}

#[tauri::command]
pub fn regenerate_mobile_pin_cmd(state: State<'_, DbState>) -> Result<String, String> {
    state.lock().map_err(|e| e.to_string())?.regenerate_mobile_token()
}

#[tauri::command]
pub fn get_mobile_server_info(state: State<'_, DbState>) -> Result<crate::mobile_api::MobileServerInfo, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    crate::mobile_api::server_info(&db)
}
