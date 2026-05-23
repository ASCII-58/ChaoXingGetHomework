import { Router } from "./router.js";
import {
  checkSession as checkSessionCommand,
  fetchCourseList,
  fetchHomeworkList,
  loginWithPassword,
  loadConfig,
  saveConfig,
  loadData,
  saveData
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
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${path}`);
  });
};

// ---- App state ----
let appState = {
  items: [],
  courses: [],
  hasCookie: false,
  cookie: null,
  phone: "",
  dataPath: null,
  notifications: true,
  filterStatus: "all",
  filterSearch: "",
  filterCourse: "all",
  statsFilter: "all",
  ignoreCourses: [],
  ignoreHomework: [],
  notifiedIds: [],
};

const STATUS_CLASS = {
  Completed: "badge-success",
  Pending: "badge-warning",
  Overdue: "badge-danger",
  Unknown: "badge-muted"
};

const updateSessionDisplay = (cookie) => {
  appState.hasCookie = !!cookie;
  setStatusPill(!!cookie ? "ok" : "error", !!cookie ? "已连接" : "未连接");
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

// ---- Persistence ----
const persistConfig = () => saveConfig({
  phone: appState.phone || null,
  cookie: appState.cookie || null,
  notifications: appState.notifications,
  data_path: appState.dataPath,
});

const persistData = () => saveData({
  ignore_courses: appState.ignoreCourses,
  ignore_homework: appState.ignoreHomework,
  notified_ids: appState.notifiedIds,
});

// ---- Ignore ----
const ignoreCourse = (courseId) => {
  if (!appState.ignoreCourses.includes(courseId)) {
    appState.ignoreCourses.push(courseId);
    persistData();
  }
  applyFiltersAndRender();
  showToast("已忽略该课程", "success");
};

const ignoreHomework = (hwId) => {
  if (!appState.ignoreHomework.includes(hwId)) {
    appState.ignoreHomework.push(hwId);
    persistData();
  }
  applyFiltersAndRender();
  showToast("已忽略该作业", "success");
};

const makeHwId = (item) => `${item.course_id}_${item.class_id}_${item.title}`;

// ---- Notifications ----
const ensureNotifPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const isWithinOneDay = (deadline) => {
  if (/剩余\s*0\s*天/.test(deadline)) return true;
  if (/剩余\s*1\s*天/.test(deadline)) return true;
  if (/剩余.*小时/.test(deadline)) return true;
  return false;
};

const sendNotifications = async (items) => {
  if (!appState.notifications) return;
  const permitted = await ensureNotifPermission();
  if (!permitted) return;

  const notified = new Set(appState.notifiedIds);

  for (const item of items) {
    if (item.status_code !== "Pending") continue;
    if (!isWithinOneDay(item.deadline)) continue;
    const hwId = makeHwId(item);
    if (notified.has(hwId)) continue;

    try {
      new Notification("作业即将截止", {
        body: `${item.title} 将于 ${item.deadline} 截止`,
        icon: "/icon.png"
      });
      notified.add(hwId);
    } catch {
      /* ignore */
    }
  }
  appState.notifiedIds = [...notified];
  persistData();
};

// ---- Login Page ----
const renderLogin = () => {
  $("app-content").innerHTML = `
    <div class="card">
      <div class="card-title">密码登录</div>
      <div class="card-body">
        <form id="password-form" class="form">
          <div class="field">
            <label for="phone">手机号</label>
            <input id="phone" name="phone" type="text" class="input" placeholder="请输入学习通手机号" autocomplete="username" value="${escapeHtml(appState.phone)}" />
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
    </div>
    <div class="card">
      <div class="card-title">Cookie 登录</div>
      <div class="card-body">
        <form id="cookie-form" class="form">
          <div class="field">
            <label for="cookie">Cookie 字符串</label>
            <textarea id="cookie" name="cookie" rows="4" class="input mono" placeholder="从浏览器 DevTools 粘贴完整 Cookie">${escapeHtml(appState.cookie || "")}</textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="cookie-login-btn">设置 Cookie</button>
            <button class="btn btn-danger" type="button" id="cookie-clear-btn">清除</button>
          </div>
        </form>
      </div>
    </div>
  `;
};

// ---- Homework Page ----
const renderHomework = () => {
  $("app-content").innerHTML = `
    <div id="homework-header">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:18px;font-weight:600;">作业</h2>
        <button class="btn btn-sm" type="button" id="refresh-btn">刷新</button>
      </div>
      <div class="stats-row" id="stats-row"></div>
      <div class="filter-bar" id="filter-bar"></div>
    </div>
    <div id="homework-content"></div>
  `;
  loadHomeworkData();
};

const loadHomeworkData = async () => {
  const content = $("homework-content");
  content.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const [items, courses] = await Promise.all([
      fetchHomeworkList(),
      fetchCourseList()
    ]);
    appState.items = items;
    appState.courses = courses;
    buildCourseMap(courses);
    applyFiltersAndRender();
    sendNotifications(items);
    showToast(`加载 ${items.length} 项作业`, "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    content.innerHTML = `<div class="empty-hint">加载失败: ${escapeHtml(msg)}</div>`;
    showToast(msg, "error");
  }
};

let courseNameMap = {};
let courseCpiMap = {};

const buildCourseMap = (courses) => {
  courseNameMap = {};
  courseCpiMap = {};
  for (const c of courses) {
    courseNameMap[c.course_id] = c.course_name || c.name;
    courseCpiMap[c.course_id] = c.cpi;
  }
};

const getFilteredItems = () => {
  let items = appState.items;
  const ignoredCourses = appState.ignoreCourses;
  const ignoredHomework = appState.ignoreHomework;

  items = items.filter((i) => !ignoredCourses.includes(i.course_id));
  items = items.filter((i) => !ignoredHomework.includes(makeHwId(i)));

  if (appState.filterStatus === "pending") {
    items = items.filter((i) => i.status_code === "Pending");
  } else if (appState.filterStatus === "completed") {
    items = items.filter((i) => i.status_code === "Completed");
  } else if (appState.filterStatus === "overdue") {
    items = items.filter((i) => i.status_code === "Overdue");
  }

  if (appState.filterSearch) {
    const q = appState.filterSearch.toLowerCase();
    items = items.filter((i) => (i.title || "").toLowerCase().includes(q));
  }

  if (appState.filterCourse !== "all") {
    items = items.filter((i) => i.course_id === Number(appState.filterCourse));
  }

  return items;
};

const applyFiltersAndRender = () => {
  renderStatsRow();
  renderFilterBar();
  updateHomeworkView();
};

const renderStatsRow = () => {
  const stats = $("stats-row");
  if (!stats) return;
  const ignoredCourses = appState.ignoreCourses;
  const ignoredHomework = appState.ignoreHomework;
  let all = appState.items;
  all = all.filter((i) => !ignoredCourses.includes(i.course_id));
  all = all.filter((i) => !ignoredHomework.includes(makeHwId(i)));
  const total = all.length;
  const pending = all.filter((i) => i.status_code === "Pending").length;
  const completed = all.filter((i) => i.status_code === "Completed").length;
  const overdue = all.filter((i) => i.status_code === "Overdue").length;
  const active = appState.statsFilter;

  stats.innerHTML = `
    <button class="stat-pill${active === "all" ? " active" : ""}" data-stat="all">
      <span class="stat-count">${total}</span>
      <span class="stat-label">全部</span>
    </button>
    <button class="stat-pill${active === "pending" ? " active" : ""}" data-stat="pending">
      <span class="stat-count">${pending}</span>
      <span class="stat-label">待提交</span>
    </button>
    <button class="stat-pill${active === "completed" ? " active" : ""}" data-stat="completed">
      <span class="stat-count">${completed}</span>
      <span class="stat-label">已完成</span>
    </button>
    <button class="stat-pill${active === "overdue" ? " active" : ""}" data-stat="overdue">
      <span class="stat-count">${overdue}</span>
      <span class="stat-label">已截止</span>
    </button>
  `;
};

const renderFilterBar = () => {
  const bar = $("filter-bar");
  if (!bar) return;

  const statusActive = appState.filterStatus;
  const courseOptions = appState.courses
    .filter((c) => !appState.ignoreCourses.includes(c.course_id))
    .map((c) =>
    `<option value="${c.course_id}"${appState.filterCourse === String(c.course_id) ? " selected" : ""}>${escapeHtml(c.course_name || c.name)}</option>`
  ).join("");

  bar.innerHTML = `
    <input class="filter-search" id="filter-search" type="text" placeholder="搜索作业标题..." value="${escapeHtml(appState.filterSearch)}" />
    <div class="filter-status">
      <button class="filter-status-btn${statusActive === "all" ? " active" : ""}" data-status="all">全部</button>
      <button class="filter-status-btn${statusActive === "pending" ? " active" : ""}" data-status="pending">待提交</button>
      <button class="filter-status-btn${statusActive === "completed" ? " active" : ""}" data-status="completed">已完成</button>
      <button class="filter-status-btn${statusActive === "overdue" ? " active" : ""}" data-status="overdue">已截止</button>
    </div>
    <select class="filter-course" id="filter-course">
      <option value="all">全部课程</option>
      ${courseOptions}
    </select>
  `;
};

const updateHomeworkView = () => {
  const filtered = getFilteredItems();
  const content = $("homework-content");
  if (!content) return;

  if (filtered.length === 0) {
    content.innerHTML = '<div class="empty-hint">没有匹配的作业</div>';
    return;
  }

  const grouped = {};
  for (const item of filtered) {
    const courseName = courseNameMap[item.course_id] || item.course_name || "未知课程";
    if (!grouped[courseName]) grouped[courseName] = [];
    const cpi = courseCpiMap[item.course_id] || item.cpi || 0;
    grouped[courseName].push({ ...item, cpi });
  }

  let html = '<div class="homework-sections">';
  for (const [courseName, hwItems] of Object.entries(grouped)) {
    const courseId = hwItems[0].course_id;
    const groupClassId = hwItems[0].class_id || '';
    const groupCpi = courseCpiMap[courseId] || hwItems[0].cpi || 0;
    html += `
      <div>
        <div class="homework-group-header" data-course-id="${courseId}" data-class-id="${groupClassId}" data-cpi="${groupCpi}">
          <span class="homework-group-name">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
              <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h2.38a1 1 0 0 1 .83.44L7.93 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
            </svg>
            ${escapeHtml(courseName)}
          </span>
          <span class="homework-group-right">
            <span class="homework-group-count">${hwItems.length} 项作业</span>
            <button class="btn-ignore-group" data-ignore-course="${courseId}" title="忽略该课程全部作业">忽略课程</button>
          </span>
        </div>
        <div class="homework-cards">
    `;
    for (const hw of hwItems) {
      const badgeClass = STATUS_CLASS[hw.status_code] || "badge-muted";
      const hwId = makeHwId(hw);
      html += `
        <div class="homework-card" data-course-id="${hw.course_id}" data-class-id="${hw.class_id}" data-cpi="${hw.cpi}">
          <div class="homework-card-top">
            <span class="homework-card-title">
              ${hw.unread ? '<span class="homework-unread-dot"></span>' : ""}
              ${escapeHtml(hw.title || "无标题")}
            </span>
            <span class="homework-card-actions">
              <span class="badge ${badgeClass}">${escapeHtml(hw.status_label)}</span>
              <button class="btn-ignore-hw" data-ignore-hwid="${escapeHtml(hwId)}" title="忽略该作业">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 4l8 8M12 4l-8 8"/>
                </svg>
              </button>
            </span>
          </div>
          <div class="homework-card-meta">
            <span>${escapeHtml(hw.deadline)}</span>
          </div>
          <div class="homework-card-course">${escapeHtml(courseName)}</div>
        </div>
      `;
    }
    html += "</div></div>";
  }
  html += "</div>";
  content.innerHTML = html;
};

// ---- Settings Page ----
const renderSettings = () => {
  const ignoredCourses = appState.ignoreCourses;
  const ignoredHomework = appState.ignoreHomework;
  let ignoredHtml = "";
  if (ignoredCourses.length || ignoredHomework.length) {
    ignoredHtml = '<div class="settings-section"><div class="settings-label">已忽略</div>';
    if (ignoredCourses.length) {
      ignoredHtml += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted);">课程:</div>';
      for (const id of ignoredCourses) {
        const c = appState.courses.find((c) => c.course_id === id);
        const name = c ? (c.course_name || c.name) : `课程 #${id}`;
        ignoredHtml += `<div class="ignored-item"><span>${escapeHtml(name)}</span><button class="btn-ignore-clear" data-unignore-course="${id}">取消忽略</button></div>`;
      }
    }
    if (ignoredHomework.length) {
      ignoredHtml += '<div style="margin-bottom:4px;font-size:12px;color:var(--muted);">作业:</div>';
      ignoredHtml += `<div style="font-size:12px;color:var(--muted);">共 ${ignoredHomework.length} 项</div>`;
      ignoredHtml += '<button class="btn btn-sm" id="clear-ignored-homework" style="margin-top:8px;">清除所有忽略的作业</button>';
    }
    ignoredHtml += '</div>';
  }

  $("app-content").innerHTML = `
    <div class="card">
      <div class="card-title card-title-icon-wrap">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="8" cy="8" r="2"/>
          <path d="M8 1.5l.867 2.305a1 1 0 0 0 .829.62l2.45.253-1.817 1.639a1 1 0 0 0-.282.9l.5 2.393-2.227-.964a1 1 0 0 0-.64 0l-2.227.964.5-2.392a1 1 0 0 0-.282-.9L3.854 4.678l2.45-.253a1 1 0 0 0 .83-.62L8 1.5z"/>
        </svg>
        设置
      </div>

      <div class="settings-section">
        <div class="settings-label">会话状态</div>
        <div class="settings-row" style="margin-bottom:8px;">
          <span id="settings-status-text" style="font-size:14px;">${appState.hasCookie ? "Cookie 已保存" : "未连接"}</span>
          <button class="btn btn-sm" type="button" id="settings-check-btn">检查会话</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Cookie 管理</div>
        <div class="field" style="margin-bottom:8px;">
          <textarea id="settings-cookie" rows="3" class="input mono" placeholder="Cookie 字符串">${escapeHtml(appState.cookie || "")}</textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" type="button" id="settings-cookie-set">设置 Cookie</button>
          <button class="btn btn-danger btn-sm" type="button" id="settings-cookie-clear">清除 Cookie</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">手机号</div>
        <div class="save-phone-row">
          <input id="settings-phone" type="text" class="input" placeholder="请输入学习通手机号" value="${escapeHtml(appState.phone)}" />
          <button class="btn btn-sm" type="button" id="settings-save-phone">保存</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row">
          <div>
            <div class="settings-label">桌面通知</div>
            <div class="settings-desc">作业截止前推送桌面通知</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="settings-notifications" ${appState.notifications ? "checked" : ""} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      ${ignoredHtml}

      <div class="about-section">
        <div class="about-name">学习通助手</div>
        <div class="about-version">v1.0.0</div>
        <a class="about-link" href="https://github.com/anomalyco/xxt" target="_blank">GitHub</a>
      </div>
    </div>
  `;
};

// ---- Event Handlers ----
const handlePasswordLogin = async (event) => {
  event.preventDefault();
  const phone = $("phone").value.trim();
  const password = $("password").value.trim();
  if (!phone || !password) { showToast("请填写手机号和密码", "error"); return; }
  appState.phone = phone;
  try {
    const result = await loginWithPassword({ phone, password });
    if (result?.cookies) {
      appState.cookie = result.cookies;
      const cookieEl = $("cookie");
      if (cookieEl) cookieEl.value = result.cookies;
    }
    await persistConfig();
    setStatusPill("ok", "已连接");
    showToast("登录成功", "success");
    router.navigate("/homework");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    setStatusPill("error", "登录失败");
    showToast(msg, "error");
  }
};

const handleSavePhone = () => {
  const phone = $("phone")?.value.trim() || $("settings-phone")?.value.trim();
  if (!phone) { showToast("请输入手机号", "error"); return; }
  appState.phone = phone;
  persistConfig();
  showToast("手机号已保存", "success");
};

const handleCookieLogin = async (event) => {
  event.preventDefault();
  const cookie = $("cookie").value.trim();
  if (!cookie) { showToast("请输入 Cookie", "error"); return; }
  appState.cookie = cookie;
  await persistConfig();
  setStatusPill("ok", "已连接");
  showToast("Cookie 已保存", "success");
  router.navigate("/homework");
};

const handleClearCookie = () => {
  appState.cookie = null;
  persistConfig();
  const cookieEl = $("cookie") || $("settings-cookie");
  if (cookieEl) cookieEl.value = "";
  updateSessionDisplay("");
  showToast("已清除 Cookie", "success");
};

const handleSettingsSetCookie = async () => {
  const cookie = $("settings-cookie").value.trim();
  if (!cookie) { showToast("请输入 Cookie", "error"); return; }
  appState.cookie = cookie;
  await persistConfig();
  setStatusPill("ok", "已连接");
  showToast("Cookie 已保存", "success");
};

const handleNotificationToggle = () => {
  appState.notifications = $("settings-notifications").checked;
  persistConfig();
  showToast(appState.notifications ? "通知已开启" : "通知已关闭");
};

// ---- Event Delegation ----
const setupDelegatedEvents = () => {
  $("app-content").addEventListener("click", async (event) => {
    const target = event.target;

    const unignoreBtn = target.closest(".btn-ignore-clear");
    if (unignoreBtn) {
      const courseId = Number(unignoreBtn.getAttribute("data-unignore-course"));
      if (courseId) {
        appState.ignoreCourses = appState.ignoreCourses.filter((id) => id !== courseId);
        persistData();
        showToast("已取消忽略", "success");
        renderSettings();
      }
      return;
    }

    const card = target.closest(".homework-card");
    if (card && !target.closest(".btn-ignore-hw") && !target.closest(".btn-ignore-group")) {
      const courseId = card.getAttribute("data-course-id");
      const classId = card.getAttribute("data-class-id");
      const cpi = card.getAttribute("data-cpi");
      const url = `https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${courseId}&clazzid=${classId}&cpi=${cpi}&ismooc2=1&v=2`;
      try {
        const { open } = await import("@tauri-apps/api/shell");
        open(url);
      } catch {
        window.open(url, "_blank");
      }
      return;
    }

    const groupHeader = target.closest(".homework-group-header");
    if (groupHeader && !target.closest(".btn-ignore-group")) {
      const courseId = groupHeader.getAttribute("data-course-id");
      const classId = groupHeader.getAttribute("data-class-id");
      const cpi = groupHeader.getAttribute("data-cpi");
      const url = `https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${courseId}&clazzid=${classId}&cpi=${cpi}&ismooc2=1&v=2`;
      try {
        const { open } = await import("@tauri-apps/api/shell");
        open(url);
      } catch {
        window.open(url, "_blank");
      }
      return;
    }

    const ignoreHwBtn = target.closest(".btn-ignore-hw");
    if (ignoreHwBtn) {
      ignoreHomework(ignoreHwBtn.getAttribute("data-ignore-hwid"));
      return;
    }

    const ignoreGroupBtn = target.closest(".btn-ignore-group");
    if (ignoreGroupBtn) {
      ignoreCourse(Number(ignoreGroupBtn.getAttribute("data-ignore-course")));
      return;
    }

    if (target.id === "clear-ignored-homework") {
      appState.ignoreHomework = [];
      persistData();
      showToast("已清除所有忽略的作业", "success");
      renderSettings();
      return;
    }

    if (target.id === "save-btn") {
      handleSavePhone();
      return;
    }

    if (target.id === "cookie-clear-btn" || target.id === "settings-cookie-clear") {
      handleClearCookie();
      return;
    }

    if (target.id === "settings-cookie-set") {
      handleSettingsSetCookie();
      return;
    }

    if (target.id === "settings-check-btn") {
      checkSession();
      return;
    }

    if (target.id === "settings-save-phone") {
      handleSavePhone();
      return;
    }

    if (target.id === "refresh-btn") {
      loadHomeworkData();
      return;
    }

    const statBtn = target.closest(".stat-pill");
    if (statBtn) {
      const stat = statBtn.getAttribute("data-stat");
      appState.statsFilter = stat;
      appState.filterStatus = stat;
      applyFiltersAndRender();
      return;
    }

    const statusBtn = target.closest(".filter-status-btn");
    if (statusBtn) {
      const status = statusBtn.getAttribute("data-status");
      appState.filterStatus = status;
      appState.statsFilter = status;
      applyFiltersAndRender();
      return;
    }
  });

  $("app-content").addEventListener("submit", (event) => {
    if (event.target.id === "password-form") {
      handlePasswordLogin(event);
    } else if (event.target.id === "cookie-form") {
      handleCookieLogin(event);
    }
  });

  $("app-content").addEventListener("input", (event) => {
    if (event.target.id === "filter-search") {
      appState.filterSearch = event.target.value;
      updateHomeworkView();
    }
  });

  $("app-content").addEventListener("change", (event) => {
    if (event.target.id === "filter-course") {
      appState.filterCourse = event.target.value;
      updateHomeworkView();
    }
    if (event.target.id === "settings-notifications") {
      handleNotificationToggle();
    }
  });
};

// ---- App Init ----
const loadPersisted = async () => {
  const [config, data] = await Promise.all([
    loadConfig(),
    loadData()
  ]);
  if (config?.phone) appState.phone = config.phone;
  if (config?.cookie) appState.cookie = config.cookie;
  if (config?.notifications !== null && config?.notifications !== undefined) {
    appState.notifications = config.notifications;
  }
  appState.dataPath = config?.data_path || null;
  appState.ignoreCourses = data?.ignore_courses || [];
  appState.ignoreHomework = data?.ignore_homework || [];
  appState.notifiedIds = data?.notified_ids || [];
  updateSessionDisplay(appState.cookie);
};

const router = new Router(updateNav);

router
  .route("/login", renderLogin)
  .route("/homework", renderHomework)
  .route("/settings", renderSettings);

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
