// Windows helpers for screen sharing.

use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr::{null, null_mut};
use std::time::Duration;

use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{CloseHandle, HWND, INVALID_HANDLE_VALUE, LPARAM, POINT, RECT};
use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
    TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowW, GetClientRect, GetWindowRect, GetWindowTextW,
    GetWindowThreadProcessId, IsWindow, IsWindowVisible, ShowWindow, SW_HIDE,
};

// --- "… is sharing a window" bar ---------------------------------------------------------
// While a share is live, WebView2 shows Chromium's capture notification bar along the
// bottom of the screen ("http://tauri.localhost is sharing a window. Stop sharing / Hide").
// WebView2 has no setting for it, so a watcher hides it the way its own Hide button does.
// Zennith's call controls stop the share instead. The bar's window title is its text,
// which always contains the page origin.

const SHARE_BAR_MARKER: &str = "tauri.localhost";

fn window_title(hwnd: HWND) -> String {
    let mut buf = [0u16; 512];
    let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
}

unsafe extern "system" fn collect_share_bars(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let found = unsafe { &mut *(lparam as *mut Vec<HWND>) };
    if unsafe { IsWindowVisible(hwnd) } != 0 && window_title(hwnd).contains(SHARE_BAR_MARKER) {
        found.push(hwnd);
    }
    1
}

// Our process and everything it started (the WebView2 browser and its helpers).
fn own_process_tree() -> HashSet<u32> {
    let mut tree = HashSet::from([std::process::id()]);
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return tree;
    }
    let mut links = Vec::new();
    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
    let mut ok = unsafe { Process32FirstW(snapshot, &mut entry) };
    while ok != 0 {
        links.push((entry.th32ProcessID, entry.th32ParentProcessID));
        ok = unsafe { Process32NextW(snapshot, &mut entry) };
    }
    unsafe { CloseHandle(snapshot) };
    loop {
        let before = tree.len();
        for &(pid, parent) in &links {
            if tree.contains(&parent) {
                tree.insert(pid);
            }
        }
        if tree.len() == before {
            return tree;
        }
    }
}

fn hide_share_bars() {
    let mut found: Vec<HWND> = Vec::new();
    unsafe { EnumWindows(Some(collect_share_bars), &mut found as *mut Vec<HWND> as LPARAM) };
    if found.is_empty() {
        return;
    }
    let tree = own_process_tree();
    for hwnd in found {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        // Our main window is titled "Zennith", so it never matches; the check keeps other
        // apps' windows that happen to mention the origin out of it.
        if pid != std::process::id() && tree.contains(&pid) {
            unsafe { ShowWindow(hwnd, SW_HIDE) };
        }
    }
}

pub fn watch_share_bar() {
    std::thread::spawn(|| loop {
        hide_share_bars();
        std::thread::sleep(Duration::from_millis(400));
    });
}

// --- Window share cropping -----------------------------------------------------------------
// A window share captures the whole window, title bar and borders included. Games in
// "borderless" mode often keep a title bar just off-screen, which then shows up in the
// share. These are the client area's distances from the captured frame, in physical
// pixels, so the call can crop to what the window actually displays.

#[derive(serde::Serialize)]
pub struct WindowInsets {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
    width: i32,
    height: i32,
}

pub fn client_insets(hwnd: Option<i64>, title: Option<String>) -> Option<WindowInsets> {
    let mut hwnd = hwnd.map_or(null_mut(), |h| h as isize as HWND);
    if hwnd.is_null() || unsafe { IsWindow(hwnd) } == 0 {
        let title: Vec<u16> = title?.encode_utf16().chain(std::iter::once(0)).collect();
        hwnd = unsafe { FindWindowW(null(), title.as_ptr()) };
        if hwnd.is_null() {
            return None;
        }
    }
    let mut frame = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    let dwm = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            &mut frame as *mut RECT as *mut c_void,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    if dwm != 0 && unsafe { GetWindowRect(hwnd, &mut frame) } == 0 {
        return None;
    }
    let mut client = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    let mut origin = POINT { x: 0, y: 0 };
    if unsafe { GetClientRect(hwnd, &mut client) } == 0
        || unsafe { ClientToScreen(hwnd, &mut origin) } == 0
        || client.right <= 0
        || client.bottom <= 0
    {
        return None;
    }
    let width = frame.right - frame.left;
    let height = frame.bottom - frame.top;
    if width <= 0 || height <= 0 {
        return None;
    }
    let clamp = |v: i32, max: i32| v.clamp(0, max);
    Some(WindowInsets {
        left: clamp(origin.x - frame.left, width),
        top: clamp(origin.y - frame.top, height),
        right: clamp(frame.right - (origin.x + client.right), width),
        bottom: clamp(frame.bottom - (origin.y + client.bottom), height),
        width,
        height,
    })
}
