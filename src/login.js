import crypto from "node:crypto";

const AES_KEY = "u2oh6Vu^HWe4_AES";
const REFER_URL =
  "https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const encrypt = (value) => {
  const key = Buffer.from(AES_KEY, "utf8");
  const iv = Buffer.from(AES_KEY, "utf8");
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return encrypted.toString("base64");
};

const buildLoginPageUrl = () => {
  const params = new URLSearchParams({
    refer: encodeURIComponent(REFER_URL),
    fid: "503",
    newversion: "true",
    _blank: "0"
  });
  return `https://passport2.chaoxing.com/login?${params.toString()}`;
};

const extractCookieString = (headers) => {
  if (!headers) {
    return "";
  }

  const normalize = (values) =>
    values
      .map((value) => value.split(";")[0])
      .filter(Boolean)
      .join("; ");

  if (typeof headers.get === "function") {
    const headerValue = headers.get("set-cookie");
    if (headerValue) {
      const parts = headerValue.split(/,(?=[^;]+?=)/);
      return normalize(parts);
    }
  }

  if (typeof headers.raw === "function") {
    const raw = headers.raw()["set-cookie"];
    if (Array.isArray(raw)) {
      return normalize(raw);
    }
  }

  if (headers instanceof Map) {
    const value = headers.get("set-cookie");
    if (value) {
      const parts = Array.isArray(value) ? value : [value];
      return normalize(parts);
    }
  }

  return "";
};

const parseLoginResponse = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (text.includes("您所浏览的页面暂时不能访问") || text.includes("<html")) {
      const blocked = new LoginError(
        "captcha_required",
        "Captcha required or IP blocked"
      );
      blocked.cause = error;
      throw blocked;
    }

    const invalid = new LoginError("invalid_response", "Login response invalid");
    invalid.cause = error;
    throw invalid;
  }
};

export class LoginError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LoginError";
    this.code = code;
  }
}

export const login = async ({ phone, password, fetch: fetchImpl }) => {
  const fetcher = fetchImpl ?? fetch;
  const loginPageUrl = buildLoginPageUrl();

  await fetcher(loginPageUrl, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT
    }
  });

  const response = await fetcher("https://passport2.chaoxing.com/fanyalogin", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: loginPageUrl,
      "User-Agent": USER_AGENT
    },
    body: new URLSearchParams({
      fid: "503",
      uname: encrypt(phone),
      password: encrypt(password),
      refer: encodeURIComponent(REFER_URL),
      t: "true",
      forbidotherlogin: "0",
      validate: "",
      doubleFactorLogin: "0",
      independentId: "0",
      independentNameId: "0"
    }).toString()
  });

  const text =
    typeof response.text === "function"
      ? await response.text()
      : JSON.stringify(await response.json());
  const data = parseLoginResponse(text);
  if (!data.status) {
    throw new LoginError("invalid_credentials", data.msg2 ?? "Login failed");
  }

  const cookieString = extractCookieString(response.headers);
  return { ...data, cookies: cookieString };
};
