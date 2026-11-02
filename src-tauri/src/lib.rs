mod app_updater;
use tauri::{Manager, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};
static EXIT_GUARD_READY: AtomicBool = AtomicBool::new(false);
pub(crate) fn approve_update_exit(){EXIT_APPROVED.store(true,Ordering::SeqCst);}
static EXIT_APPROVED: AtomicBool = AtomicBool::new(false);
#[tauri::command]
fn enable_exit_guard() { EXIT_GUARD_READY.store(true, Ordering::SeqCst); }
#[tauri::command]
fn finish_app_exit(app: tauri::AppHandle) { EXIT_APPROVED.store(true, Ordering::SeqCst); app.exit(0); }
use tauri_plugin_fs::FsExt;
use tauri_plugin_dialog::DialogExt;
use std::path::{Path, PathBuf};
use std::io::Write;

fn grants_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("workspace-roots.json"))
}
fn saved_roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    grants_file(app).ok().and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}
fn grant_root(app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    app.fs_scope().allow_directory(path, true).map_err(|e| e.to_string())?;
    // Explicit hidden application data; arbitrary hidden OS directories stay excluded.
    app.fs_scope().allow_directory(path.join("データ"), true).map_err(|e| e.to_string())?;
    for file in [".エントリー一覧.meta.json", ".エントリー一覧.pending.json", ".エントリー一覧.recovery.json"] {
        app.fs_scope().allow_file(path.join("データ").join(file)).map_err(|e| e.to_string())?;
    }
    app.fs_scope().allow_directory(path.join(".aishukatsu-trash"), true).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn pick_workspace_directory(app: tauri::AppHandle, create: bool) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(chosen) = app.dialog().file().set_title(if create { "AI就活フォルダを作成する場所" } else { "就活フォルダを選択" }).blocking_pick_folder() else { return Ok(None); };
        let mut path = chosen.into_path().map_err(|e| e.to_string())?;
        if create { path = path.join("AI就活"); std::fs::create_dir_all(&path).map_err(|e| e.to_string())?; }
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        grant_root(&app, &path)?;
        let mut roots = saved_roots(&app);
        if !roots.contains(&path) { roots.push(path.clone()); }
        std::fs::write(grants_file(&app)?, serde_json::to_vec(&roots).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        Ok(Some(path.to_string_lossy().into_owned()))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn restore_workspace_permission(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    let Ok(path) = PathBuf::from(path).canonicalize() else { return Ok(false); };
    if !saved_roots(&app).contains(&path) { return Ok(false); }
    grant_root(&app, &path)?; Ok(true)
}

#[tauri::command]
async fn atomic_write_workspace_file(app: tauri::AppHandle, path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(path);
    let parent = path.parent().ok_or("保存先が不正です")?.canonicalize().map_err(|e| e.to_string())?;
    let target = parent.join(path.file_name().ok_or("ファイル名が不正です")?);
    if !app.fs_scope().is_allowed(&target) { return Err("選択したフォルダの外には保存できません".into()); }
    if std::fs::symlink_metadata(&target).map(|m| m.file_type().is_symlink()).unwrap_or(false) { return Err("リンク先への保存はできません".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let temp = parent.join(format!(".aishukatsu-write-{}-{}", std::process::id(), nonce));
        let result = (|| -> Result<(), String> {
            let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|e| e.to_string())?;
            file.write_all(&bytes).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            drop(file);
            std::fs::rename(&temp, &target).map_err(|e| e.to_string())?;
            Ok(())
        })();
        if result.is_err() { let _ = std::fs::remove_file(temp); }
        result
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // On desktop: ensure only one instance is running. A second launch
    // (e.g. triggered by the OS opening an `aisyuukatsu://` deep link)
    // re-focuses the existing window and forwards the URL via the
    // deep-link plugin.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Re-focus main window on re-launch.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            // Never log callback URLs: they contain authentication credentials.
            let _ = argv;
        }));
    }

    builder
        .menu(|app| {
            let menu=tauri::menu::Menu::default(app)?;
            #[cfg(any(target_os="macos",target_os="windows"))]
            if let Some(first)=menu.items()?.first() {
                if let Some(submenu)=first.as_submenu() {
                    let count=submenu.items()?.len();
                    if count>0 { submenu.remove_at(count-1)?; }
                    let quit=tauri::menu::MenuItem::with_id(app,"save-and-quit","AI就活を終了",true,Some("CmdOrCtrl+Q"))?;
                    submenu.append(&quit)?;
                    let check=tauri::menu::MenuItem::with_id(app,"check-app-update","アプリの更新を確認…",true,None::<&str>)?;
                    submenu.insert(&check,1)?;
                }
            }
            Ok(menu)
        })
        .on_menu_event(|app,event| {
            if event.id().as_ref()=="check-app-update" {let _=app.emit("aishukatsu-open-updates",());}
            if event.id().as_ref()=="save-and-quit" {
                if EXIT_GUARD_READY.load(Ordering::SeqCst) { let _=app.emit("aishukatsu-request-exit",()); }
                else { app.exit(0); }
            }
        })
        .manage(app_updater::AppUpdaterState::default())
        .invoke_handler(tauri::generate_handler![app_updater::app_update_check,app_updater::app_update_download,app_updater::app_update_install,pick_workspace_directory, restore_workspace_permission, atomic_write_workspace_file, enable_exit_guard, finish_app_exit])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Register the custom URL scheme at runtime on Linux/Windows dev
            // builds where the installer-based registration isn't available.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("aisyuukatsu");
            }
            for root in saved_roots(app.handle()) { if root.is_dir() { let _ = grant_root(app.handle(), &root); } }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app,event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if EXIT_GUARD_READY.load(Ordering::SeqCst) && !EXIT_APPROVED.load(Ordering::SeqCst) {
                    if let Some(window) = app.get_webview_window("main") {
                        api.prevent_exit();
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("aishukatsu-request-exit", ());
                    }
                }
            }
        });
}
