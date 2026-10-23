use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};

// Passed by the login item so a launch at sign-in starts in the tray.
const MINIMIZED_ARG: &str = "--minimized";

// Mirrors the `closeToTray` setting; the frontend syncs it on startup and on change.
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

// Anti-aliased filled circle, used as the Windows taskbar overlay icon.
#[cfg(windows)]
fn dot_icon(rgb: [u8; 3]) -> tauri::image::Image<'static> {
    const SIZE: u32 = 16;
    let center = (SIZE as f32 - 1.0) / 2.0;
    let radius = SIZE as f32 / 2.0 - 0.5;
    let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for y in 0..SIZE {
        for x in 0..SIZE {
            let d = ((x as f32 - center).powi(2) + (y as f32 - center).powi(2)).sqrt();
            let alpha = (radius - d + 0.5).clamp(0.0, 1.0);
            rgba.extend_from_slice(&[rgb[0], rgb[1], rgb[2], (alpha * 255.0) as u8]);
        }
    }
    tauri::image::Image::new_owned(rgba, SIZE, SIZE)
}

// `state` is "highlight" (mentions), "unread" or anything else for none.
#[tauri::command]
fn set_unread_badge(window: WebviewWindow, state: String) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        let icon = match state.as_str() {
            "highlight" => Some(dot_icon([0xf2, 0x3f, 0x43])),
            "unread" => Some(dot_icon([0xb5, 0xba, 0xc1])),
            _ => None,
        };
        window.set_overlay_icon(icon)
    }
    #[cfg(target_os = "macos")]
    {
        window.set_badge_label(match state.as_str() {
            "highlight" | "unread" => Some("•".to_string()),
            _ => None,
        })
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (window, state);
        Ok(())
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Zennith", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Zennith", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Zennith")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Must be registered first: a second launch (desktop shortcut while Zennith sits
        // in the tray) focuses the running window instead of starting another client.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                show_main_window(app);
            }))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![MINIMIZED_ARG]),
            ));
    }

    builder
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![set_close_to_tray, set_unread_badge])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && CLOSE_TO_TRAY.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                build_tray(app.handle())?;
            }

            // The window starts hidden (tauri.conf.json) so a login launch never flashes.
            if !std::env::args().any(|arg| arg == MINIMIZED_ARG) {
                show_main_window(app.handle());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
