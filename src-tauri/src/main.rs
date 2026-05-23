#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes::cipher::BlockEncryptMut;
use aes::Aes128;
use base64::{engine::general_purpose, Engine as _};
use cbc::{cipher::block_padding::Pkcs7, cipher::KeyIvInit, Encryptor};
use reqwest::header::SET_COOKIE;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use std::path::PathBuf;
use std::fs;

const AES_KEY: &str = "u2oh6Vu^HWe4_AES";
const REFER_URL: &str = "https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction";
const USER_AGENT: &str =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[derive(Default)]
struct AppState {
  cookie_string: Mutex<Option<String>>,
  storage_path: PathBuf,
}

#[derive(Serialize)]
struct LoginResult {
  status: bool,
  name: Option<String>,
  url: Option<String>,
  cookies: String,
}

#[derive(Serialize)]
struct SessionStatus {
  status: String,
  reason: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct CourseInfo {
  key: i64,
  cpi: i64,
  class_id: i64,
  name: String,
  course_name: String,
  course_id: i64,
  teacher_factor: String,
  student_count: i32,
  image_url: String,
  role_type: i32,
}

#[derive(Serialize, Clone)]
struct HomeworkItem {
  title: String,
  status_label: String,
  status_code: String,
  course_name: String,
  deadline: String,
  task_url: String,
  unread: bool,
  course_id: i64,
  class_id: i64,
}

fn encrypt(value: &str) -> String {
  let key = AES_KEY.as_bytes();
  let iv = AES_KEY.as_bytes();
  let cipher = Encryptor::<Aes128>::new(key.into(), iv.into());
  let data = value.as_bytes();
  let block_size: usize = 16;
  let pad_len = block_size - (data.len() % block_size);
  let mut buffer = vec![0u8; data.len() + pad_len];
  buffer[..data.len()].copy_from_slice(data);
  let encrypted = cipher
    .encrypt_padded_mut::<Pkcs7>(&mut buffer, data.len())
    .expect("padding failed");
  general_purpose::STANDARD.encode(encrypted)
}

fn build_login_page_url() -> String {
  let refer = urlencoding::encode(REFER_URL);
  format!(
    "https://passport2.chaoxing.com/login?refer={}&fid=503&newversion=true&_blank=0",
    refer
  )
}

fn extract_cookie_string(headers: &reqwest::header::HeaderMap) -> String {
  let mut parts = Vec::new();
  for value in headers.get_all(SET_COOKIE).iter() {
    if let Ok(raw) = value.to_str() {
      if let Some(cookie) = raw.split(';').next() {
        if !cookie.is_empty() {
          parts.push(cookie.to_string());
        }
      }
    }
  }
  parts.join("; ")
}

fn is_session_expired(url: &str, body: &str) -> bool {
  let lower = body.to_lowercase();
  url.contains("passport2.chaoxing.com/login")
    || url.contains("passport.chaoxing.com/login")
    || (lower.contains("passport") && lower.contains("login") && body.len() < 2000)
}

#[tauri::command]
async fn login_with_password(
  phone: String,
  password: String,
  state: State<'_, AppState>,
) -> Result<LoginResult, String> {
  let login_page_url = build_login_page_url();
  let client = reqwest::Client::builder()
    .cookie_store(true)
    .user_agent(USER_AGENT)
    .build()
    .map_err(|error| error.to_string())?;

  client
    .get(&login_page_url)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let uname = encrypt(&phone);
  let pwd = encrypt(&password);
  let refer_enc = urlencoding::encode(REFER_URL);
  let params = [
    ("fid", "503"),
    ("uname", uname.as_str()),
    ("password", pwd.as_str()),
    ("refer", &refer_enc),
    ("t", "true"),
    ("forbidotherlogin", "0"),
    ("validate", ""),
    ("doubleFactorLogin", "0"),
    ("independentId", "0"),
    ("independentNameId", "0"),
  ];

  let response = client
    .post("https://passport2.chaoxing.com/fanyalogin")
    .header("X-Requested-With", "XMLHttpRequest")
    .header("Referer", login_page_url)
    .form(&params)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let headers = response.headers().clone();
  let text = response
    .text()
    .await
    .map_err(|error| error.to_string())?;

  let payload: serde_json::Value = serde_json::from_str(&text).map_err(|_| {
    if text.contains("您所浏览的页面暂时不能访问") || text.contains("<html") {
      "captcha_required".to_string()
    } else {
      "invalid_response".to_string()
    }
  })?;

  let status = payload
    .get("status")
    .and_then(|value| value.as_bool())
    .unwrap_or(false);
  if !status {
    let message = payload
      .get("msg2")
      .and_then(|value| value.as_str())
      .unwrap_or("login_failed");
    return Err(message.to_string());
  }

  let cookie_string = extract_cookie_string(&headers);
  if !cookie_string.is_empty() {
    let mut guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    *guard = Some(cookie_string.clone());
  }

  Ok(LoginResult {
    status,
    name: payload
      .get("name")
      .and_then(|value| value.as_str())
      .map(|value| value.to_string()),
    url: payload
      .get("url")
      .and_then(|value| value.as_str())
      .map(|value| value.to_string()),
    cookies: cookie_string,
  })
}

#[tauri::command]
async fn set_cookie(cookie: String, state: State<'_, AppState>) -> Result<(), String> {
  let mut guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
  *guard = if cookie.trim().is_empty() {
    None
  } else {
    Some(cookie)
  };
  let mut config = load_config(&state.storage_path);
  config.cookie = guard.clone();
  save_config(&state.storage_path, &config)?;
  Ok(())
}

#[tauri::command]
async fn get_cookie(state: State<'_, AppState>) -> Result<String, String> {
  let guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
  Ok(guard.clone().unwrap_or_default())
}

#[tauri::command]
async fn clear_cookie(state: State<'_, AppState>) -> Result<(), String> {
  let mut guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
  *guard = None;
  let mut config = load_config(&state.storage_path);
  config.cookie = None;
  save_config(&state.storage_path, &config)?;
  Ok(())
}

#[tauri::command]
async fn save_phone(phone: String, state: State<'_, AppState>) -> Result<(), String> {
  let mut config = load_config(&state.storage_path);
  config.phone = if phone.trim().is_empty() {
    None
  } else {
    Some(phone)
  };
  save_config(&state.storage_path, &config)?;
  Ok(())
}

#[tauri::command]
async fn load_config_state(state: State<'_, AppState>) -> Result<StoredConfig, String> {
  Ok(load_config(&state.storage_path))
}

#[tauri::command]
async fn check_session(state: State<'_, AppState>) -> Result<SessionStatus, String> {
  let cookie = {
    let guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    guard.clone().unwrap_or_default()
  };
  if cookie.is_empty() {
    return Ok(SessionStatus {
      status: "missing".to_string(),
      reason: "no_cookie".to_string(),
    });
  }

  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .build()
    .map_err(|error| error.to_string())?;

  let response = client
    .get("https://mooc1.chaoxing.com/work/stu-work?ut=s")
    .header("Cookie", &cookie)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let url = response.url().to_string();
  let body = response.text().await.map_err(|error| error.to_string())?;
  if is_session_expired(&url, &body) {
    return Ok(SessionStatus {
      status: "expired".to_string(),
      reason: "login_required".to_string(),
    });
  }

  Ok(SessionStatus {
    status: "valid".to_string(),
    reason: "ok".to_string(),
  })
}

#[tauri::command]
async fn fetch_course_list(state: State<'_, AppState>) -> Result<Vec<CourseInfo>, String> {
  let cookie = {
    let guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    guard.clone().ok_or("no_cookie".to_string())?
  };

  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .build()
    .map_err(|error| error.to_string())?;

  let response = client
    .get("https://mooc1-api.chaoxing.com/mycourse/backclazzdata?view=json&rss=1")
    .header("Cookie", &cookie)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let text = response.text().await.map_err(|error| error.to_string())?;

  let payload: serde_json::Value = serde_json::from_str(&text).map_err(|_| {
    if text.contains("passport") && text.contains("login") {
      "cookie_expired".to_string()
    } else {
      "invalid_response".to_string()
    }
  })?;

  let channel_list = payload
    .get("channelList")
    .and_then(|v| v.as_array())
    .ok_or("no_channel_list")?;

  let mut courses = Vec::new();
  for channel in channel_list {
    let content = match channel.get("content") {
      Some(c) => c,
      None => continue,
    };

    let course = match content.get("course") {
      Some(c) => c,
      None => continue,
    };
    let data = match course.get("data") {
      Some(d) => d,
      None => continue,
    };
    let data_arr = match data.as_array() {
      Some(arr) if !arr.is_empty() => arr,
      _ => continue,
    };
    let first = &data_arr[0];

    courses.push(CourseInfo {
      key: channel.get("key").and_then(|v| v.as_i64()).unwrap_or(0),
      cpi: content.get("cpi").and_then(|v| v.as_i64()).unwrap_or(0),
      class_id: content.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
      name: content.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
      course_name: first.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
      course_id: first.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
      teacher_factor: first.get("teacherfactor").and_then(|v| v.as_str()).unwrap_or("").to_string(),
      student_count: content.get("studentcount").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
      image_url: first.get("imageurl").and_then(|v| v.as_str()).unwrap_or("").to_string(),
      role_type: content.get("roletype").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
    });
  }

  let cp = courses_path().unwrap_or_default();
  let _ = save_courses(&cp, &courses);

  Ok(courses)
}

fn status_code(label: &str) -> &str {
  match label {
    "已完成" | "已批阅" | "待批阅" => "Completed",
    "未提交" | "未交" | "已提交" => "Pending",
    "已截止" => "Overdue",
    _ => "Unknown",
  }
}

#[tauri::command]
async fn fetch_homework_list(state: State<'_, AppState>) -> Result<Vec<HomeworkItem>, String> {
  let cookie = {
    let guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    guard.clone().ok_or("no_cookie".to_string())?
  };

  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .build()
    .map_err(|error| error.to_string())?;

  let response = client
    .get("https://mooc1.chaoxing.com/work/stu-work?ut=s")
    .header("Cookie", &cookie)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let url = response.url().to_string();
  let html = response.text().await.map_err(|error| error.to_string())?;
  if is_session_expired(&url, &html) {
    return Err("cookie_expired".to_string());
  }

  let li_re = regex::Regex::new(r"(?s)<li\b[^>]*goTask[^>]*>(.*?)</li>")
    .map_err(|e| e.to_string())?;
  let data_re = regex::Regex::new(r#"data\s*=\s*"([^"]*)""#)
    .map_err(|e| e.to_string())?;
  let p_re = regex::Regex::new(r"<p\b[^>]*>([^<]*)</p>")
    .map_err(|e| e.to_string())?;
  let status_re = regex::Regex::new(r"(?s)<p\b[^>]*>.*?</p>\s*<span[^>]*>([^《<]*)</span>")
    .map_err(|e| e.to_string())?;
  let course_re = regex::Regex::new(r"《([^》]*)》")
    .map_err(|e| e.to_string())?;
  let deadline_re = regex::Regex::new(
    r#"<span\b[^>]*class\s*=\s*"[^"]*\bfr\b[^"]*"[^>]*>([^<]*)</span>"#,
  )
  .map_err(|e| e.to_string())?;

    let course_id_re = regex::Regex::new(r"courseId=(\d+)")
      .map_err(|e| e.to_string())?;
    let class_id_re = regex::Regex::new(r"clazzId=(\d+)")
      .map_err(|e| e.to_string())?;

  let mut items = Vec::new();
  for caps in li_re.captures_iter(&html) {
    let full = caps.get(0).map(|m| m.as_str()).unwrap_or("");
    let inner = caps.get(1).map(|m| m.as_str()).unwrap_or("");

    let task_url = data_re
      .captures(full)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str().to_string())
      .unwrap_or_default();

    let title = p_re
      .captures(inner)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str().to_string())
      .unwrap_or_default();

    let status_label = status_re
      .captures(inner)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str().to_string())
      .unwrap_or_default();

    let course_name = course_re
      .captures(inner)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str().to_string())
      .unwrap_or_default();

    let deadline = deadline_re
      .captures(inner)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str().to_string())
      .unwrap_or_default();

    let unread = full.contains("redPoint");

    let course_id: i64 = course_id_re
      .captures(&task_url)
      .and_then(|c| c.get(1))
      .and_then(|m| m.as_str().parse().ok())
      .unwrap_or(0);

    let class_id: i64 = class_id_re
      .captures(&task_url)
      .and_then(|c| c.get(1))
      .and_then(|m| m.as_str().parse().ok())
      .unwrap_or(0);

    items.push(HomeworkItem {
      title,
      status_label: status_label.clone(),
      status_code: status_code(&status_label).to_string(),
      course_name,
      deadline,
      task_url,
      unread,
      course_id,
      class_id,
    });
  }

  Ok(items)
}

#[tauri::command]
async fn resolve_task_url(
  task_url: String,
  state: State<'_, AppState>,
) -> Result<String, String> {
  let cookie = {
    let guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    guard.clone().ok_or("no_cookie".to_string())?
  };

  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .build()
    .map_err(|error| error.to_string())?;

  let response = client
    .get(&task_url)
    .header("Cookie", &cookie)
    .header("Referer", "https://mooc1.chaoxing.com/work/stu-work?ut=s")
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let status = response.status();
  let final_url = response.url().to_string();
  let html = response.text().await.map_err(|error| error.to_string())?;

  if !status.is_success() {
    return Err(format!("backend_http_{}_final_{}", status.as_u16(), final_url));
  }

  // 1) look for any form action or link with dowork/work/task
  let path_re =
    regex::Regex::new(r#"action="([^"]+)"|<a\s[^>]*href="([^"]+)"|<form[^>]+action="([^"]+)"#)
      .map_err(|e| e.to_string())?;
  for caps in path_re.captures_iter(&html) {
    for i in 1..=3 {
      if let Some(m) = caps.get(i) {
        let val = m.as_str();
        if val.contains("dowork") || val.contains("work/task") {
          let url = if val.starts_with("http") {
            val.to_string()
          } else if val.starts_with("/") {
            format!("https://mooc1.chaoxing.com{}", val)
          } else {
            format!("https://mooc1.chaoxing.com/{}", val)
          };
          return Ok(url);
        }
      }
    }
  }

  // 2) search HTML for an `enc` hex token near enc/standardEnc
  let token_re = regex::Regex::new(r#"(?:enc|standardEnc)\s*[:=]\s*["']?([0-9a-f]{32})"#)
    .map_err(|e| e.to_string())?;
  let token_opt = token_re.captures(&html).and_then(|c| c.get(1));

  if let Some(tok) = token_opt {
    let token = tok.as_str();
    let tid_re = regex::Regex::new(r"(?:taskrefId|workId)=(\d+)")
      .map_err(|e| e.to_string())?;
    let tid = tid_re
      .captures(&task_url)
      .and_then(|c| c.get(1))
      .or_else(|| tid_re.captures(&final_url).and_then(|c| c.get(1)))
      .or_else(|| tid_re.captures(&html).and_then(|c| c.get(1)))
      .map(|m| m.as_str())
      .unwrap_or("0");
    let cid_re = regex::Regex::new(r"courseId=(\d+)").map_err(|e| e.to_string())?;
    let cid = cid_re
      .captures(&final_url)
      .and_then(|c| c.get(1))
      .or_else(|| cid_re.captures(&html).and_then(|c| c.get(1)))
      .map(|m| m.as_str())
      .unwrap_or("0");
    let clid_re = regex::Regex::new(r"classId=(\d+)").map_err(|e| e.to_string())?;
    let clid = clid_re
      .captures(&final_url)
      .and_then(|c| c.get(1))
      .or_else(|| clid_re.captures(&html).and_then(|c| c.get(1)))
      .map(|m| m.as_str())
      .unwrap_or("0");
    let cpi_re = regex::Regex::new(r"cpi=(\d+)").map_err(|e| e.to_string())?;
    let cpi = cpi_re
      .captures(&final_url)
      .and_then(|c| c.get(1))
      .map(|m| m.as_str())
      .unwrap_or("0");

    return Ok(format!(
      "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/dowork?courseId={}&classId={}&cpi={}&workId={}&answerId=0&enc={}",
      cid, clid, cpi, tid, token
    ));
  }

  // 3) fallback – phone page is viewable in browser
  Ok(final_url)
}

fn default_data_path() -> Result<PathBuf, String> {
  let base = dirs::data_dir().ok_or("no_data_dir")?;
  Ok(base.join("xxt").join("data.json"))
}

fn resolve_data_path(config: &StoredConfig) -> Result<PathBuf, String> {
  match &config.data_path {
    Some(p) if !p.is_empty() => Ok(PathBuf::from(p)),
    _ => default_data_path(),
  }
}

#[tauri::command]
async fn save_config_state(config: StoredConfig, state: State<'_, AppState>) -> Result<(), String> {
  {
    let mut guard = state.cookie_string.lock().map_err(|_| "lock_failed")?;
    *guard = config.cookie.clone();
  }
  save_config(&state.storage_path, &config)?;
  Ok(())
}

#[tauri::command]
async fn load_data_state(state: State<'_, AppState>) -> Result<StoredData, String> {
  let config = load_config(&state.storage_path);
  let data_path = resolve_data_path(&config)?;
  if let Ok(content) = fs::read_to_string(&data_path) {
    Ok(serde_json::from_str(&content).unwrap_or_default())
  } else {
    Ok(StoredData::default())
  }
}

#[tauri::command]
async fn save_data_state(data: StoredData, state: State<'_, AppState>) -> Result<(), String> {
  let config = load_config(&state.storage_path);
  let data_path = resolve_data_path(&config)?;
  if let Some(parent) = data_path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let payload = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
  fs::write(&data_path, payload).map_err(|e| e.to_string())?;
  Ok(())
}

fn main() {
  let storage_path = storage_path().expect("storage path");
  let config = load_config(&storage_path);
  let cookie_state = config.cookie.clone();
  tauri::Builder::default()
    .manage(AppState {
      cookie_string: Mutex::new(cookie_state),
      storage_path,
    })
    .invoke_handler(tauri::generate_handler![
      login_with_password,
      set_cookie,
      get_cookie,
      clear_cookie,
      check_session,
      save_phone,
      load_config_state,
      save_config_state,
      load_data_state,
      save_data_state,
      fetch_course_list,
      fetch_homework_list,
      resolve_task_url,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
#[derive(Serialize, serde::Deserialize, Default, Clone)]
struct StoredConfig {
  phone: Option<String>,
  cookie: Option<String>,
  notifications: Option<bool>,
  data_path: Option<String>,
}

#[derive(Serialize, serde::Deserialize, Default, Clone)]
struct StoredData {
  ignore_courses: Option<Vec<i64>>,
  ignore_homework: Option<Vec<String>>,
  notified_ids: Option<Vec<String>>,
}
fn storage_path() -> Result<PathBuf, String> {
  let base = dirs::data_dir().ok_or("no_data_dir")?;
  let path = base.join("xxt");
  Ok(path.join("config.json"))
}

fn courses_path() -> Result<PathBuf, String> {
  let base = dirs::data_dir().ok_or("no_data_dir")?;
  let path = base.join("xxt");
  Ok(path.join("courses.json"))
}

fn save_courses(path: &PathBuf, courses: &[CourseInfo]) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  let payload = serde_json::to_string_pretty(courses).map_err(|error| error.to_string())?;
  fs::write(path, payload).map_err(|error| error.to_string())
}

fn load_config(path: &PathBuf) -> StoredConfig {
  if let Ok(content) = fs::read_to_string(path) {
    serde_json::from_str(&content).unwrap_or_default()
  } else {
    StoredConfig::default()
  }
}

fn save_config(path: &PathBuf, config: &StoredConfig) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  let payload = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
  fs::write(path, payload).map_err(|error| error.to_string())
}
