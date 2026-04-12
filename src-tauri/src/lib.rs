use tauri::Manager;

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
            // Log the deep-link URL for debugging; the deep-link plugin
            // emits `on_open_url` events that the JS side listens for.
            for arg in &argv {
                if arg.starts_with("aisyuukatsu://") {
                    eprintln!("[single-instance] deep link: {}", arg);
                }
            }
        }));
    }

    builder
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
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
