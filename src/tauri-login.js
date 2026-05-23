import { invoke } from "@tauri-apps/api/tauri";

const isTauri = () =>
  typeof window !== "undefined" && typeof window.__TAURI_IPC__ === "function";

const safeInvoke = (cmd, args) => {
  if (!isTauri()) {
    const error = new Error("只能在 Tauri 桌面窗口中运行。浏览器环境不支持原生系统 API。");
    console.warn(`[Mock] 拦截到对 ${cmd} 的调用，因为当前处于普通浏览器环境。`);
    return Promise.reject(error);
  }
  return invoke(cmd, args);
};

export const loginWithPassword = ({ phone, password }) =>
  safeInvoke("login_with_password", { phone, password });

export const setCookie = (cookie) => safeInvoke("set_cookie", { cookie });
export const getCookie = () =>
  isTauri() ? invoke("get_cookie") : Promise.resolve("");
export const clearCookie = () => safeInvoke("clear_cookie");
export const checkSession = () => safeInvoke("check_session");
export const savePhone = (phone) => safeInvoke("save_phone", { phone });

export const loadConfig = () =>
  isTauri() ? invoke("load_config_state") : Promise.resolve({});

export const saveConfig = (config) => safeInvoke("save_config_state", { config });

export const loadData = () =>
  isTauri() ? invoke("load_data_state") : Promise.resolve({});

export const saveData = (data) => safeInvoke("save_data_state", { data });

export const fetchCourseList = () => safeInvoke("fetch_course_list");

export const fetchHomeworkList = () => safeInvoke("fetch_homework_list");
