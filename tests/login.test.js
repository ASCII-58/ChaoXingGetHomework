import { describe, expect, it } from "vitest";
import { LoginError, login } from "../src/login.js";

describe("login", () => {

  it("encrypts phone and password before POSTing", async () => {
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        text: async () => JSON.stringify({ status: true, name: "student" }),
        headers: new Map([["set-cookie", "UID=1; Path=/"]])
      };
    };

    await login({
      phone: "13800138000",
      password: "secret",
      fetch: fakeFetch
    });

    expect(calls).toHaveLength(2);
    const post = calls[1];
    expect(post.url).toBe("https://passport2.chaoxing.com/fanyalogin");
    expect(post.init.method).toBe("POST");
    expect(post.init.headers["X-Requested-With"]).toBe("XMLHttpRequest");
    const body = new URLSearchParams(post.init.body);
    expect(body.get("uname")).not.toBe("13800138000");
    expect(body.get("password")).not.toBe("secret");
    expect(body.get("t")).toBe("true");
  });

  it("returns cookies after successful login", async () => {
    const fakeFetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: true, name: "student" }),
      headers: {
        get: (key) => (key === "set-cookie" ? "UID=1; Path=/" : null)
      }
    });

    const result = await login({
      phone: "13800138000",
      password: "secret",
      fetch: fakeFetch
    });

    expect(result.cookies).toBe("UID=1");
  });

  it("throws when credentials are invalid", async () => {
    const fakeFetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: false, msg2: "密码错误" }),
      headers: new Map()
    });

    await expect(
      login({
        phone: "13800138000",
        password: "wrong",
        fetch: fakeFetch
      })
    ).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  it("throws when captcha is required", async () => {
    const fakeFetch = async () => ({
      ok: true,
      text: async () =>
        "<html><head><title>您所浏览的页面暂时不能访问</title></head></html>",
      headers: new Map()
    });

    await expect(
      login({
        phone: "13800138000",
        password: "secret",
        fetch: fakeFetch
      })
    ).rejects.toMatchObject({ code: "captcha_required" });
  });
});
