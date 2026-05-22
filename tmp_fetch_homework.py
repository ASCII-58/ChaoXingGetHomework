"""Fetch with GBK encoding and dump real homework blocks."""
import json
import re
import http.cookiejar
from base64 import b64encode
from urllib.parse import quote, urlencode, unquote
from urllib.request import Request, build_opener, HTTPCookieProcessor
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

AES_KEY = b"u2oh6Vu^HWe4_AES"
PHONE = "18134303697"
PASSWORD = "xyxy1029@hbu"
REFER_URL = "https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def encrypt(val):
    cipher = AES.new(AES_KEY, AES.MODE_CBC, iv=AES_KEY)
    return b64encode(cipher.encrypt(pad(val.encode(), 16))).decode()

def login():
    cj = http.cookiejar.CookieJar()
    opener = build_opener(HTTPCookieProcessor(cj))
    login_url = f"https://passport2.chaoxing.com/login?refer={quote(REFER_URL)}&fid=503&newversion=true&_blank=0"
    opener.open(Request(login_url, headers={"User-Agent": UA}))
    body = urlencode({
        "fid": "503", "uname": encrypt(PHONE), "password": encrypt(PASSWORD),
        "refer": quote(REFER_URL), "t": "true",
        "forbidotherlogin": "0", "validate": "",
        "doubleFactorLogin": "0", "independentId": "0", "independentNameId": "0",
    }).encode()
    resp = opener.open(Request(
        "https://passport2.chaoxing.com/fanyalogin", data=body,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": login_url,
        },
    ))
    text = resp.read().decode("utf-8", errors="replace")
    j = json.loads(text)
    print(f"Login OK: name={j.get('name','?')}")
    return opener

def fetch_gbk(opener, url):
    req = Request(url, headers={"User-Agent": UA})
    resp = opener.open(req)
    raw = resp.read()
    for enc in ["gbk", "gb2312", "gb18030", "utf-8"]:
        try:
            text = raw.decode(enc)
            if "登录" in text or "作业" in text or "课程" in text:
                return text
        except:
            pass
    return raw.decode("gbk", errors="replace")

def dump_homework_blocks(html):
    print(f"\n{'='*70}")
    print(f"HTML size: {len(html)} bytes")
    print(f"{'='*70}")

    # Extract <li> blocks with goTask
    li_blocks = re.findall(r'<li\b[^>]*goTask[^>]*>.*?</li>', html, re.DOTALL)

    print(f"\nFound {len(li_blocks)} homework <li> blocks\n")

    for i, blk in enumerate(li_blocks[:8]):
        print(f"--- Block {i+1} ---")

        # Extract data URL
        data_m = re.search(r'data\s*=\s*"([^"]*)"', blk)
        url_val = data_m.group(1) if data_m else "N/A"
        print(f"  data URL: {url_val[:120]}")

        # Extract title from <p>
        p_m = re.search(r'<p\b[^>]*>([^<]*)</p>', blk)
        title = p_m.group(1).strip() if p_m else "N/A"
        print(f"  title: {title}")

        # Extract status
        status_m = re.search(r'<span\b[^>]*class\s*=\s*"[^"]*\bstatus\b[^"]*"[^>]*>([^<]*)</span>', blk)
        status = status_m.group(1).strip() if status_m else "N/A"
        print(f"  status: {status}")

        # Extract course name 《...》
        course_m = re.search(r'《([^》]*)》', blk)
        course = course_m.group(1).strip() if course_m else "N/A"
        print(f"  course: {course}")

        # Extract deadline
        dl_m = re.search(r'<span\b[^>]*class\s*=\s*"[^"]*\bfr\b[^"]*"[^>]*>([^<]*)</span>', blk)
        deadline = dl_m.group(1).strip() if dl_m else "N/A"
        print(f"  deadline: {deadline}")

        # Check for redPoint
        red = bool(re.search(r'redPoint', blk))
        print(f"  unread: {red}")

        # Full block for reference
        clean = blk.replace("\r", "").replace("\n", " ").replace("\t", " ")
        clean = re.sub(r'\s+', ' ', clean)
        print(f"  raw: {clean[:300]}")
        print()

    # Save full HTML
    path = "E:/Github/xxt/tmp_homework_gbk.html"
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Saved to {path}")

def main():
    opener = login()

    html = fetch_gbk(opener, "https://mooc1.chaoxing.com/work/stu-work?ut=s")
    dump_homework_blocks(html)

if __name__ == "__main__":
    main()
