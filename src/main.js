import { Router } from "./router.js";
import {
  checkSession as checkSessionCommand,
  clearCookie as clearCookieCommand,
  fetchCourseList,
  getCookie as getCookieCommand,
  loginWithPassword,
  loadConfig,
  savePhone,
  setCookie as setCookieCommand
} from "./tauri-login.js";

const $ = (id) => document.getElementById(id);

const escapeHtml = (str) => {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
};

const showToast = (message, type = "success") => {
  const msg = $("toast-message");
  const svg = $("toast-svg");
  msg.textContent = message;
  if (type === "error") {
    svg.setAttribute("fill", "var(--danger)");
    svg.querySelector("path").setAttribute("d", "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z");
  } else {
    svg.setAttribute("fill", "var(--success)");
    svg.querySelector("path").setAttribute("d", "M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-1.042-.018L6.75 10.1l-2.25-2.25a.751.751 0 0 0-1.042 1.042l2.75 2.75a.75.75 0 0 0 1.06 0l4.5-4.5a.751.751 0 0 0-.018-1.042Z");
  }
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
};

const setStatusPill = (state, message) => {
  $("status-pill").textContent = message;
  const dot = $("status-dot");
  dot.className = "status-dot";
  if (state === "ok") dot.classList.add("ok");
  else if (state === "error") dot.classList.add("err");
};

const updateNav = (path) => {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${path}`);
  });
};

// ---- App state ----
let appState = { hasCookie: false };

const updateSessionDisplay = (cookie) => {
  appState.hasCookie = !!cookie;
  if (cookie) {
    setStatusPill("ok", "已保存 Cookie");
  } else {
    setStatusPill("error", "未连接");
  }
};

const checkSession = async () => {
  try {
    const result = await checkSessionCommand();
    if (result.status === "missing") {
      setStatusPill("error", "未连接");
      showToast("请先登录或粘贴 Cookie", "error");
    } else if (result.status === "expired") {
      setStatusPill("error", "Cookie 过期");
      showToast("Cookie 已过期，请重新登录", "error");
    } else {
      setStatusPill("ok", "会话有效");
      showToast("会话有效", "success");
    }
  } catch {
    showToast("检查失败，请稍后重试", "error");
  }
};

// ---- Login page ----
const renderLogin = () => {
  const phone = appState.phone ?? "";
  const cookie = appState.cookie ?? "";
  $("app-content").innerHTML = `
    <div class="card">
      <div class="card-title">密码登录</div>
      <form id="password-form" class="form">
        <div class="field">
          <label for="phone">手机号</label>
          <input id="phone" name="phone" type="text" class="input" placeholder="请输入学习通手机号" autocomplete="username" value="${escapeHtml(phone)}" />
        </div>
        <div class="field">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" class="input" placeholder="请输入密码" autocomplete="current-password" />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" id="login-btn">登录</button>
          <button class="btn" type="button" id="save-btn">仅保存</button>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-title">Cookie 登录</div>
      <form id="cookie-form" class="form">
        <div class="field">
          <label for="cookie">Cookie 字符串</label>
          <textarea id="cookie" name="cookie" rows="4" class="input mono" placeholder="从浏览器 DevTools 粘贴完整 Cookie">${escapeHtml(cookie)}</textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" id="cookie-login-btn">设置 Cookie</button>
          <button class="btn btn-danger" type="button" id="cookie-clear-btn">清除</button>
        </div>
      </form>
    </div>
  `;
};

// ---- Courses page ----
const renderCourses = () => {
  $("app-content").innerHTML = `
    <div class="card">
      <div class="card-title">课程列表</div>
      <div class="form">
        <div class="form-actions">
          <button class="btn btn-primary" type="button" id="fetch-courses-btn">获取课程列表</button>
        </div>
        <pre class="debug-output" id="courses-raw"></pre>
        <div class="course-list" id="course-list"></div>
      </div>
    </div>
  `;
};

const fetchCourses = async () => {
  const raw = $("courses-raw");
  const list = $("course-list");
  raw.textContent = "加载中...";
  try {
    const courses = await fetchCourseList();
    raw.textContent = JSON.stringify(courses, null, 2);
    list.innerHTML = "";
    if (!courses.length) {
      list.innerHTML = "<div class=\"empty-hint\">未找到课程，请先登录</div>";
      showToast("未找到课程", "error");
      return;
    }
    for (const c of courses) {
      const card = document.createElement("div");
      card.className = "course-card";
      card.innerHTML = `
        <div class="course-card-header">
          <span class="course-name">${escapeHtml(c.name)}</span>
          <span class="course-count">${c.student_count} 人</span>
        </div>
        <div class="course-card-body">
          <div class="course-meta"><span class="course-label">课程ID</span><span class="course-value">${c.course_id}</span></div>
          <div class="course-meta"><span class="course-label">班级ID</span><span class="course-value">${c.class_id}</span></div>
          <div class="course-meta"><span class="course-label">CPI</span><span class="course-value">${c.cpi}</span></div>
        </div>
      `;
      list.appendChild(card);
    }
    showToast(`获取到 ${courses.length} 门课程`, "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    raw.textContent = msg;
    list.innerHTML = "<div class=\"empty-hint\">获取失败</div>";
    showToast(msg, "error");
  }
};

// ---- Login handlers ----
const handlePasswordLogin = async (event) => {
  event.preventDefault();
  const phone = $("phone").value.trim();
  const password = $("password").value.trim();
  if (!phone || !password) { showToast("请填写手机号和密码", "error"); return; }
  await savePhone(phone);
  appState.phone = phone;
  try {
    const result = await loginWithPassword({ phone, password });
    if (result?.cookies) {
      await setCookieCommand(result.cookies);
      appState.cookie = result.cookies;
      $("cookie").value = result.cookies;
    }
    setStatusPill("ok", "登录成功");
    showToast("登录成功", "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    setStatusPill("error", "登录失败");
    showToast(msg, "error");
  }
};

const handleSavePhone = () => {
  const phone = $("phone").value.trim();
  if (!phone) { showToast("请输入手机号", "error"); return; }
  savePhone(phone);
  appState.phone = phone;
  showToast("手机号已保存", "success");
};

const handleCookieLogin = async (event) => {
  event.preventDefault();
  const cookie = $("cookie").value.trim();
  if (!cookie) { showToast("请输入 Cookie", "error"); return; }
  await setCookieCommand(cookie);
  appState.cookie = cookie;
  setStatusPill("ok", "Cookie 已保存");
  showToast("Cookie 已保存", "success");
};

const handleClearCookie = async () => {
  await clearCookieCommand();
  $("cookie").value = "";
  appState.cookie = null;
  updateSessionDisplay("");
  showToast("已清除 Cookie", "success");
};

// ---- Event delegation ----
const setupDelegatedEvents = () => {
  $("app-content").addEventListener("click", (event) => {
    const target = event.target;
    if (target.id === "fetch-courses-btn") fetchCourses();
    else if (target.id === "save-btn") handleSavePhone();
    else if (target.id === "cookie-clear-btn") handleClearCookie();
  });

  $("app-content").addEventListener("submit", (event) => {
    if (event.target.id === "password-form") handlePasswordLogin(event);
    else if (event.target.id === "cookie-form") handleCookieLogin(event);
  });

  $("check-btn").addEventListener("click", checkSession);
};

// ---- App init ----
const loadPersisted = async () => {
  const config = await loadConfig();
  if (config?.phone) appState.phone = config.phone;
  if (config?.cookie) {
    await setCookieCommand(config.cookie);
    appState.cookie = config.cookie;
  }
  updateSessionDisplay(await getCookieCommand());
};

const router = new Router(updateNav);

router
  .route("/login", renderLogin)
  .route("/courses", renderCourses);

(async () => {
  await loadPersisted().catch((error) => {
    console.error("loadPersisted failed:", error);
    updateSessionDisplay("");
    if (error?.message?.includes("桌面窗口")) {
      setTimeout(() => showToast(error.message, "error"), 500);
    }
  });
  setupDelegatedEvents();
  router.start();
})();
