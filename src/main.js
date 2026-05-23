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

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                        */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const escapeHtml = (str) => {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
};

const setButtonLoading = (el, loading) => {
  if (!el) return;
  if (loading) {
    el.disabled = true;
    el.classList.add("is-loading");
    el.dataset.originalText = el.textContent;
  } else {
    el.disabled = false;
    el.classList.remove("is-loading");
    if (el.dataset.originalText) el.textContent = el.dataset.originalText;
  }
};

const showToast = (message, type = "success") => {
  const msg = $("toast-message");
  const svg = $("toast-svg");
  msg.textContent = message;
  if (type === "error") {
    svg.setAttribute("fill", "var(--red-text)");
    svg.querySelector("path").setAttribute("d", "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z");
  } else {
    svg.setAttribute("fill", "var(--green-text)");
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
  document.querySelector(".app-layout").classList.toggle("is-login", path === "/login");
};

/* ------------------------------------------------------------------ */
/*  App state                                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Session                                                            */
/* ------------------------------------------------------------------ */

const updateSessionDisplay = (cookie) => {
  appState.hasCookie = !!cookie;
  setStatusPill(!!cookie ? "ok" : "error", !!cookie ? "已连接" : "未连接");
  const logoutBtn = $("sidebar-logout");
  if (logoutBtn) logoutBtn.style.display = !!cookie ? "" : "none";
};

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

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
  cached_items: appState.items,
  cached_courses: appState.courses,
  cached_at: Date.now(),
});

/* ------------------------------------------------------------------ */
/*  Ignore                                                             */
/* ------------------------------------------------------------------ */

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

const extractTitleFromHwId = (hwId) => {
  const idx1 = hwId.indexOf("_");
  if (idx1 === -1) return hwId;
  const idx2 = hwId.indexOf("_", idx1 + 1);
  if (idx2 === -1) return hwId;
  return hwId.substring(idx2 + 1);
};

const extractCourseIdFromHwId = (hwId) => {
  const idx = hwId.indexOf("_");
  if (idx === -1) return null;
  return Number(hwId.substring(0, idx));
};

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

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
    } catch { /* ignore */ }
  }
  appState.notifiedIds = [...notified];
  persistData();
};

/* ------------------------------------------------------------------ */
/*  Course cache                                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Page: Login                                                        */
/* ------------------------------------------------------------------ */

const switchLoginTab = (tab) => {
  document.querySelectorAll(".login-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  $("login-password-panel").classList.toggle("hidden", tab !== "password");
  $("login-cookie-panel").classList.toggle("hidden", tab !== "cookie");
};

const renderLogin = () => {
  $("app-content").innerHTML = `
    <div class="login-page">
      <div class="login-hero">
        <svg height="36" viewBox="0 0 16 16" width="36" class="login-logo">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        <h1 class="login-title">学习通助手</h1>
        <p class="login-subtitle">登录以查看作业与截止提醒</p>
      </div>

      <div class="login-card">
        <div class="login-tabs">
          <button class="login-tab active" data-tab="password" id="login-tab-password">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><circle cx="8" cy="5.5" r="0.6" fill="currentColor" stroke="none"/></svg>
            密码登录
          </button>
          <button class="login-tab" data-tab="cookie" id="login-tab-cookie">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 9.5a1.5 1.5 0 1 1 3 0M4 6.5a1.5 1.5 0 1 1 3 0v.5M7 9.5a1.5 1.5 0 1 1 3 0M10 6.5a1.5 1.5 0 1 1 3 0"/><rect x="1" y="1" width="14" height="14" rx="2"/></svg>
            Cookie
          </button>
        </div>

        <div id="login-password-panel" class="login-panel">
          <form id="password-form" class="form">
            <div class="field">
              <label for="phone">手机号</label>
              <input id="phone" name="phone" type="text" class="input" placeholder="学习通手机号" autocomplete="username" value="${escapeHtml(appState.phone)}" />
            </div>
            <div class="field">
              <label for="password">密码</label>
              <input id="password" name="password" type="password" class="input" placeholder="学习通密码" autocomplete="current-password" />
            </div>
            <div class="form-actions" style="flex-direction:column;gap:var(--space-8);">
              <button class="btn btn-primary" type="submit" id="login-btn" style="width:100%;">登 录</button>
              <button class="btn" type="button" id="save-btn" style="width:100%;">仅保存手机号</button>
            </div>
          </form>
        </div>

        <div id="login-cookie-panel" class="login-panel hidden">
          <form id="cookie-form" class="form">
            <div class="field">
              <label for="cookie">Cookie 字符串</label>
              <textarea id="cookie" name="cookie" rows="5" class="input mono" placeholder="从浏览器 DevTools 粘贴完整 Cookie&#10;示例: UID=xxxxx; _d=xxxxx; ...">${escapeHtml(appState.cookie || "")}</textarea>
            </div>
            <div class="form-actions" style="flex-direction:column;gap:var(--space-8);">
              <button class="btn btn-primary" type="submit" id="cookie-login-btn" style="width:100%;">设置并登录</button>
              <button class="btn btn-danger" type="button" id="cookie-clear-btn" style="width:100%;">清除 Cookie</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Attach tab click handlers
  $("login-tab-password").addEventListener("click", () => switchLoginTab("password"));
  $("login-tab-cookie").addEventListener("click", () => switchLoginTab("cookie"));
};

/* ------------------------------------------------------------------ */
/*  Page: Homework                                                     */
/* ------------------------------------------------------------------ */

const renderHomework = () => {
  const hasCached = appState.items.length > 0;

  $("app-content").innerHTML = `
    <div id="homework-header">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="font-size:18px;font-weight:600;">作业</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" type="button" id="ignore-panel-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="vertical-align:-2px;">
              <rect x="3" y="1.5" width="10" height="13" rx="1.5"/>
              <line x1="5" y1="6" x2="11" y2="6"/>
              <line x1="5" y1="9" x2="11" y2="9"/>
              <line x1="5" y1="12" x2="9" y2="12"/>
            </svg>
            管理忽略
          </button>
          <button class="btn btn-sm" type="button" id="refresh-btn">刷新</button>
        </div>
      </div>
      <div class="stats-row" id="stats-row"></div>
      <div class="filter-bar" id="filter-bar"></div>
    </div>
    <div id="homework-content">
      ${hasCached ? "" : '<div class="loading">加载中...</div>'}
    </div>
  `;

  if (hasCached) {
    applyFiltersAndRender();
  }

  loadHomeworkData();
};

const SKELETON_COUNT = 4;

const renderSkeletonCards = () => {
  let html = '<div class="homework-sections" style="gap:24px;">';
  for (let g = 0; g < 2; g++) {
    html += `<div>
      <div class="homework-group-header" style="pointer-events:none;">
        <span class="homework-group-name" style="display:flex;align-items:center;gap:8px;">
          <span class="skeleton-line" style="width:120px;height:16px;margin:0;"></span>
        </span>
        <span style="width:60px;height:12px;" class="skeleton-line"></span>
      </div>
      <div class="homework-cards">`;
    for (let i = 0; i < SKELETON_COUNT / 2; i++) {
      html += `<div class="skeleton">
        <div class="skeleton-line" style="width:70%;height:14px;"></div>
        <div class="skeleton-line skeleton-line-short" style="width:40%;height:12px;margin-top:6px;"></div>
      </div>`;
    }
    html += "</div></div>";
  }
  html += "</div>";
  return html;
};

const loadHomeworkData = async () => {
  const content = $("homework-content");
  const hasCached = appState.items.length > 0;

  if (!hasCached) {
    content.innerHTML = renderSkeletonCards();
  }

  const refreshBtn = $("refresh-btn");
  setButtonLoading(refreshBtn, true);

  try {
    const [items, courses] = await Promise.all([
      fetchHomeworkList(),
      fetchCourseList()
    ]);
    appState.items = items;
    appState.courses = courses;
    buildCourseMap(courses);
    persistData();
    applyFiltersAndRender();
    sendNotifications(items);
    showToast(hasCached ? `刷新完成，${items.length} 项作业` : `加载 ${items.length} 项作业`, "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    if (!hasCached) {
      content.innerHTML = `<div class="empty-hint">加载失败: ${escapeHtml(msg)}</div>`;
    }
    showToast(msg, "error");
  } finally {
    setButtonLoading(refreshBtn, false);
  }
};

/* ------------------------------------------------------------------ */
/*  Filtering                                                          */
/* ------------------------------------------------------------------ */

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
  const active = appState.filterStatus;

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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
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
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M4 4l8 8M12 4l-8 8"/>
                </svg>
              </button>
            </span>
          </div>
          <div class="homework-card-meta">
            <span>${escapeHtml(hw.deadline)}</span>
          </div>
        </div>
      `;
    }
    html += "</div></div>";
  }
  html += "</div>";
  content.innerHTML = html;
};

/* ------------------------------------------------------------------ */
/*  Page: Settings                                                     */
/* ------------------------------------------------------------------ */

const renderSettings = () => {
  const ignoredCourses = appState.ignoreCourses;
  const ignoredHomework = appState.ignoreHomework;

  let ignoredCourseList = "";
  if (ignoredCourses.length) {
    for (const id of ignoredCourses) {
      const c = appState.courses.find((c) => c.course_id === id);
      const name = c ? (c.course_name || c.name) : `课程 #${id}`;
      ignoredCourseList += `<div class="ignored-item"><span>${escapeHtml(name)}</span><button class="btn-ignore-clear" data-unignore-course="${id}">取消</button></div>`;
    }
  }

  const statusDotClass = appState.hasCookie ? "ok" : "";
  const statusText = appState.hasCookie ? "已连接" : "未连接";

  $("app-content").innerHTML = `
    <div class="settings-layout">

      <div class="settings-grid">

        <!-- Account card -->
        <div class="settings-card-grid settings-card-wide">
          <div class="settings-card-icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="5.5" r="2.5"/>
              <path d="M3 14c0-2.3 1.3-4.3 3-5.3M13 14c0-2.3-1.3-4.3-3-5.3"/>
              <line x1="2" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
          <div class="settings-card-body">
            <div class="settings-card-title">账号</div>
            <div class="settings-card-desc">
              <span class="settings-status-dot ${statusDotClass}"></span>
              ${statusText}
            </div>
            <div class="settings-account-fields">
              <div class="settings-field">
                <label class="settings-field-label">手机号</label>
                <div class="save-phone-row">
                  <input id="settings-phone" type="text" class="input" placeholder="学习通手机号" value="${escapeHtml(appState.phone)}" />
                  <button class="btn btn-sm" type="button" id="settings-save-phone">保存</button>
                </div>
              </div>
              <div class="settings-field">
                <label class="settings-field-label">Cookie</label>
                <textarea id="settings-cookie" rows="3" class="input mono settings-cookie-input" placeholder="粘贴 Cookie 字符串">${escapeHtml(appState.cookie || "")}</textarea>
                <div class="form-actions">
                  <button class="btn btn-primary btn-sm" type="button" id="settings-cookie-set">更新 Cookie</button>
                  <button class="btn btn-danger btn-sm" type="button" id="settings-cookie-clear">清除</button>
                </div>
              </div>
              <button class="btn btn-danger settings-logout-btn" type="button" id="settings-logout-btn">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6"/>
                  <path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5H11"/>
                  <path d="M6 8h8"/>
                  <path d="M11.5 5.5L14 8l-2.5 2.5"/>
                </svg>
                退出登录
              </button>
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="settings-card-grid">
          <div class="settings-card-icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 1a3 3 0 0 0-3 3v3l-1 2h8l-1-2V4a3 3 0 0 0-3-3Z"/><path d="M5 12a3 3 0 0 0 6 0"/>
            </svg>
          </div>
          <div class="settings-card-body">
            <div class="settings-card-title">桌面通知</div>
            <div class="settings-card-desc">作业截止前 1 天内推送系统通知</div>
            <div class="settings-card-action">
              <span class="settings-desc">${appState.notifications ? "已开启" : "已关闭"}</span>
              <label class="toggle">
                <input type="checkbox" id="settings-notifications" ${appState.notifications ? "checked" : ""} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        ${(ignoredCourses.length || ignoredHomework.length) ? `
        <div class="settings-card-grid settings-card-wide">
          <div class="settings-card-icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
            </svg>
          </div>
          <div class="settings-card-body">
            <div class="settings-card-title">已忽略</div>
            <div class="settings-card-desc">${ignoredCourses.length} 门课程${ignoredHomework.length ? `, ${ignoredHomework.length} 项作业` : ""}</div>
            ${ignoredCourseList}
            ${ignoredHomework.length ? `<div class="settings-ignored-count" style="margin-top:var(--space-8);">共 ${ignoredHomework.length} 项作业</div><button class="btn btn-sm btn-danger" id="clear-ignored-homework">清除所有忽略的作业</button>` : ""}
          </div>
        </div>
        ` : ""}

        <div class="settings-card-grid settings-card-wide settings-card-about">
          <div class="settings-card-body" style="text-align:center;width:100%;">
            <div class="about-name">学习通助手</div>
            <div class="about-version">v1.0.0</div>
            <a class="about-link" href="https://github.com/anomalyco/xxt" target="_blank">github.com/anomalyco/xxt</a>
          </div>
        </div>

      </div>
    </div>
  `;
};

/* ------------------------------------------------------------------ */
/*  Ignore Panel                                                       */
/* ------------------------------------------------------------------ */

const renderIgnorePanel = () => {
  const panel = $("ignore-panel-body");
  if (!panel) return;

  const ignoredCourses = appState.ignoreCourses;
  const ignoredHomework = appState.ignoreHomework;

  if (!ignoredCourses.length && !ignoredHomework.length) {
    panel.innerHTML = '<div class="ignore-panel-empty">暂无忽略项</div>';
    return;
  }

  let html = "";

  if (ignoredCourses.length) {
    html += '<div class="ignore-section"><div class="ignore-section-title">已忽略课程</div>';
    for (const id of ignoredCourses) {
      const c = appState.courses.find((c) => c.course_id === id);
      const name = c ? (c.course_name || c.name) : `课程 #${id}`;
      html += `<div class="ignore-item"><span class="ignore-item-name">${escapeHtml(name)}</span><button class="ignore-panel-unignore ignore-panel-unignore-course" data-unignore-course="${id}">取消忽略</button></div>`;
    }
    html += '</div>';
  }

  if (ignoredHomework.length) {
    html += '<div class="ignore-section"><div class="ignore-section-title">已忽略作业</div>';
    for (const hwId of ignoredHomework) {
      const title = extractTitleFromHwId(hwId);
      const cid = extractCourseIdFromHwId(hwId);
      const c = cid !== null ? appState.courses.find((c) => c.course_id === cid) : null;
      const courseLabel = c ? (c.course_name || c.name) : "";
      html += `<div class="ignore-item"><div><span class="ignore-item-name">${escapeHtml(title)}</span>${courseLabel ? `<span class="ignore-item-course">${escapeHtml(courseLabel)}</span>` : ""}</div><button class="ignore-panel-unignore ignore-panel-unignore-hw" data-unignore-hwid="${escapeHtml(hwId)}">取消忽略</button></div>`;
    }
    html += '<button class="btn btn-sm btn-danger ignore-panel-clear-all" id="ignore-panel-clear-all" style="margin-top:12px;width:100%;">清除所有忽略的作业</button>';
    html += '</div>';
  }

  panel.innerHTML = html;
};

const openIgnorePanel = () => {
  renderIgnorePanel();
  $("ignore-panel-overlay").classList.add("show");
  $("ignore-panel").classList.add("show");
};

const closeIgnorePanel = () => {
  $("ignore-panel-overlay").classList.remove("show");
  $("ignore-panel").classList.remove("show");
};

/* ------------------------------------------------------------------ */
/*  Event handlers                                                     */
/* ------------------------------------------------------------------ */

const handlePasswordLogin = async (event) => {
  event.preventDefault();
  const phone = $("phone").value.trim();
  const password = $("password").value.trim();
  if (!phone || !password) { showToast("请填写手机号和密码", "error"); return; }
  appState.phone = phone;
  const loginBtn = $("login-btn");
  setButtonLoading(loginBtn, true);
  try {
    const result = await loginWithPassword({ phone, password });
    if (result?.cookies) {
      appState.cookie = result.cookies;
      const cookieEl = $("cookie");
      if (cookieEl) cookieEl.value = result.cookies;
    }
    await persistConfig();
    updateSessionDisplay(appState.cookie);
    showToast("登录成功", "success");
    router.navigate("/homework");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    setStatusPill("error", "登录失败");
    showToast(msg, "error");
  } finally {
    setButtonLoading(loginBtn, false);
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
  const btn = $("cookie-login-btn");
  setButtonLoading(btn, true);
  try {
    await persistConfig();
    const result = await checkSessionCommand();
    if (result.status === "missing" || result.status === "expired") {
      throw new Error(result.status === "expired" ? "Cookie 已过期" : "Cookie 无效，请检查后重试");
    }
    updateSessionDisplay(appState.cookie);
    showToast("Cookie 已保存", "success");
    router.navigate("/homework");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    setStatusPill("error", "Cookie 无效");
    showToast(msg, "error");
  } finally {
    setButtonLoading(btn, false);
  }
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
  try {
    const result = await checkSessionCommand();
    if (result.status === "missing" || result.status === "expired") {
      throw new Error(result.status === "expired" ? "Cookie 已过期" : "Cookie 无效");
    }
    updateSessionDisplay(appState.cookie);
    showToast("Cookie 已保存", "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : (error?.message ?? error?.toString() ?? "未知错误");
    setStatusPill("error", "Cookie 无效");
    showToast(msg, "error");
  }
};

const handleNotificationToggle = () => {
  appState.notifications = $("settings-notifications").checked;
  persistConfig();
  showToast(appState.notifications ? "通知已开启" : "通知已关闭");
};

const handleLogout = async () => {
  appState.cookie = null;
  appState.hasCookie = false;
  appState.items = [];
  appState.courses = [];
  await persistConfig();
  persistData();
  updateSessionDisplay("");
  showToast("已退出登录", "success");
  router.navigate("/login");
};

/* ------------------------------------------------------------------ */
/*  Event delegation                                                   */
/* ------------------------------------------------------------------ */

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
      const { open } = await import("@tauri-apps/api/shell");
      const courseId = card.getAttribute("data-course-id");
      const classId = card.getAttribute("data-class-id");
      const cpi = card.getAttribute("data-cpi");
      open(`https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${courseId}&clazzid=${classId}&cpi=${cpi}&ismooc2=1&v=2`);
      return;
    }

    const groupHeader = target.closest(".homework-group-header");
    if (groupHeader && !target.closest(".btn-ignore-group")) {
      const { open } = await import("@tauri-apps/api/shell");
      const courseId = groupHeader.getAttribute("data-course-id");
      const classId = groupHeader.getAttribute("data-class-id");
      const cpi = groupHeader.getAttribute("data-cpi");
      open(`https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${courseId}&clazzid=${classId}&cpi=${cpi}&ismooc2=1&v=2`);
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

    if (target.id === "settings-logout-btn") {
      handleLogout();
      return;
    }

    if (target.id === "settings-save-phone") {
      handleSavePhone();
      return;
    }

    if (target.id === "ignore-panel-btn" || target.closest("#ignore-panel-btn")) {
      openIgnorePanel();
      return;
    }

    if (target.id === "refresh-btn") {
      loadHomeworkData();
      return;
    }

    const statBtn = target.closest(".stat-pill");
    if (statBtn) {
      const stat = statBtn.getAttribute("data-stat");
      appState.filterStatus = stat;
      applyFiltersAndRender();
      return;
    }

    const statusBtn = target.closest(".filter-status-btn");
    if (statusBtn) {
      const status = statusBtn.getAttribute("data-status");
      appState.filterStatus = status;
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
      applyFiltersAndRender();
    }
  });

  $("app-content").addEventListener("change", (event) => {
    if (event.target.id === "filter-course") {
      appState.filterCourse = event.target.value;
      applyFiltersAndRender();
    }
    if (event.target.id === "settings-notifications") {
      handleNotificationToggle();
    }
  });

  // Ignore panel
  $("ignore-panel-overlay").addEventListener("click", closeIgnorePanel);

  $("ignore-panel").addEventListener("click", (event) => {
    if (event.target.id === "ignore-panel-close" || event.target.closest("#ignore-panel-close")) {
      closeIgnorePanel();
      return;
    }

    const unignoreCourseBtn = event.target.closest(".ignore-panel-unignore-course");
    if (unignoreCourseBtn) {
      const courseId = Number(unignoreCourseBtn.getAttribute("data-unignore-course"));
      if (courseId) {
        appState.ignoreCourses = appState.ignoreCourses.filter((id) => id !== courseId);
        persistData();
        showToast("已取消忽略", "success");
        applyFiltersAndRender();
        renderIgnorePanel();
      }
      return;
    }

    const unignoreHwBtn = event.target.closest(".ignore-panel-unignore-hw");
    if (unignoreHwBtn) {
      const hwId = unignoreHwBtn.getAttribute("data-unignore-hwid");
      if (hwId) {
        appState.ignoreHomework = appState.ignoreHomework.filter((id) => id !== hwId);
        persistData();
        showToast("已取消忽略", "success");
        applyFiltersAndRender();
        renderIgnorePanel();
      }
      return;
    }

    if (event.target.id === "ignore-panel-clear-all") {
      appState.ignoreHomework = [];
      persistData();
      showToast("已清除所有忽略的作业", "success");
      applyFiltersAndRender();
      renderIgnorePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("ignore-panel").classList.contains("show")) {
      closeIgnorePanel();
    }
  });

  // Sidebar logout button (outside app-content)
  $("sidebar-logout").addEventListener("click", handleLogout);
};

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const requireAuth = (handler) => () => {
  if (!appState.hasCookie) {
    router.navigate("/login");
    showToast("请先登录", "error");
    return;
  }
  handler();
};

/* ------------------------------------------------------------------ */
/*  App init                                                           */
/* ------------------------------------------------------------------ */

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
  if (data?.cached_items?.length) {
    appState.items = data.cached_items;
    appState.courses = data.cached_courses || [];
    buildCourseMap(appState.courses);
  }
  updateSessionDisplay(appState.cookie);
};

const router = new Router(updateNav);

router
  .route("/login", renderLogin)
  .route("/homework", requireAuth(renderHomework))
  .route("/settings", requireAuth(renderSettings));

(async () => {
  await loadPersisted().catch((error) => {
    console.error("loadPersisted failed:", error);
    updateSessionDisplay("");
    if (error?.message?.includes("桌面窗口")) {
      setTimeout(() => showToast(error.message, "error"), 500);
    }
  });
  setupDelegatedEvents();

  // Smart startup: go to homework if already authed, otherwise login
  if (!window.location.hash) {
    window.location.hash = appState.hasCookie ? "#/homework" : "#/login";
  }
  router.start();
})();
