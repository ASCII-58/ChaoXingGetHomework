# Chaoxing Learning API Reference

Complete documentation of all Chaoxing (学习通) platform API endpoints
discovered and used by this project. All information was obtained through
reverse engineering the platform's web interface and login flow.

---

## 1. Authentication & Login

### 1.1 AES Encryption

Used to encrypt credentials before sending to the login endpoint.

| Parameter | Value |
|---|---|
| Algorithm | AES-128-CBC |
| Key | `u2oh6Vu^HWe4_AES` (UTF-8 bytes) |
| IV | `u2oh6Vu^HWe4_AES` (UTF-8 bytes) |
| Padding | PKCS7 |
| Output encoding | Base64 |

**What gets encrypted:**

- Phone number → sent as `uname` field
- Password → sent as `password` field (both are encrypted, not just the phone)

### 1.2 Login Page

```
GET https://passport2.chaoxing.com/login
```

**Query parameters:**

| Parameter | Value | Notes |
|---|---|---|
| `refer` | URL-encoded target URL | e.g. `https%3A%2F%2Fmooc2-ans.chaoxing.com%2Fmooc2-ans%2Fvisit%2Finteraction` |
| `fid` | `503` | Institution/school ID (503 = Hebei University) |
| `newversion` | `true` | Enables v2 login page |
| `_blank` | `0` | Embedding mode |

**Purpose:** Loads the login form, sets session cookies (`JSESSIONID`, `route`),
and populates hidden form fields (`enc`, `uuid`, etc.). Must be visited before
POSTing credentials.

**Response:** HTML login page (~71KB). Contains hidden inputs:
`fid`, `refer`, `enc`, `uuid`, `pid`, `t`, `forbidotherlogin`, `validate`,
`doubleFactorLogin`, `independentId`, `independentNameId`.

**Required headers:**

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
```

### 1.3 Login (Active Endpoint)

```
POST https://passport2.chaoxing.com/fanyalogin
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: <login page URL>
```

**Request body:**

| Field | Value | Notes |
|---|---|---|
| `fid` | `503` | Institution ID |
| `uname` | Base64(AES(phone)) | Encrypted phone number |
| `password` | Base64(AES(password)) | Encrypted password |
| `refer` | URL-encoded target | Same as login page refer |
| `t` | `true` | Encryption flag; if `true`, both phone and password ARE encrypted |
| `forbidotherlogin` | `0` | |
| `validate` | `""` | Captcha token (empty = no captcha) |
| `doubleFactorLogin` | `0` | |
| `independentId` | `0` | |
| `independentNameId` | `0` | |

**Success response (200):**

```json
{
  "status": true,
  "url": "https://...",
  "name": "student name",
  "pwd": "..."
}
```

After success, the response `Set-Cookie` headers contain the session cookies:
`_uid`, `UID`, `vc3`, `uf`, `cx_p_token`, `p_auth_token`, `xxtenc`, `DSSTASH_LOG`.

**Failure response (200):**

```json
{
  "status": false,
  "msg2": "error message"
}
```

Common errors: "密码错误" (wrong password), "用户名或密码错误" (wrong username/password).

**IP Block (200):** If the server returns HTML instead of JSON (page title:
"您所浏览的页面暂时不能访问"), the IP has been rate-limited or requires captcha.
Switch to cookie-based authentication.

### 1.4 Login (Deprecated Endpoint)

```
POST https://passport2.chaoxing.com/fanya/login   [DEPRECATED]
```

This was the old login endpoint. It only encrypted the phone number (not the
password), used `fid=-1`, and a different `refer`. It is now blocked by IP
rate limiting and/or returns captcha pages. Kept for reference only.

### 1.5 Cookie-Based Authentication

When password login is blocked, provide a complete cookie string obtained
from browser DevTools (F12 → Network → Request Headers → Cookie).

The cookie string format:

```
fid=503; _uid=XXXXXXXXX; UID=XXXXXXXXX; vc3=...; uf=...; cx_p_token=...;
p_auth_token=eyJ...; xxtenc=...; DSSTASH_LOG=...
```

Extract the user ID from cookies:

```
regex: (?:^|;\s*)(?:UID|_uid)=([^;]+)
```

### 1.6 User Info Extraction

No dedicated user info endpoint exists. The student name and ID are derived
from cookies (`_uid`/`UID`) and the login response (`name` field when available).

---

## 2. Course Management

### 2.1 Course List

```
GET https://mooc1-api.chaoxing.com/mycourse/backclazzdata
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `view` | `json` |
| `rss` | `1` |

**Response (200):**

```json
{
  "channelList": [
    {
      "cfid": -1,
      "cpi": 404944214,
      "key": 142824005,
      "content": {
        "id": 142824005,
        "cpi": 404944214,
        "name": "course display name",
        "course": {
          "data": [
            {
              "id": 232944728,
              "name": "course internal name",
              "imageurl": "https://p.ananas.chaoxing.com/...",
              "teacherfactor": "...",
              "belongSchoolId": "503"
            }
          ]
        },
        "roletype": 3,
        "studentcount": 33,
        "isstart": true,
        "bbsid": "..."
      }
    }
  ]
}
```

**Important:** Not all courses have a `course.data` array. Courses without it
(usually teacher-created test courses with `dtype: "Course"` and no `course`
field) should be skipped -- they have no homework.

**Course ID extraction:** `content.course.data[0].id` (not `content.id` or `content.course.id`).

### 2.2 Mooc2-ans Course Page

```
GET https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu
```

**Query parameters:**

| Parameter | Value | Notes |
|---|---|---|
| `courseid` | course ID | From `course.data[0].id` |
| `clazzid` | class ID | From `content.id` |
| `cpi` | CPI number | From `content.cpi` |
| `enc` | 32-char hex | **Required**. Server-generated per-course token |
| `t` | timestamp | Millisecond epoch |
| `pageHeader` | `8` | `8` = homework tab, omit for homepage |
| `v` | `2` | API version |
| `hideHead` | `0` | |

**Without valid `enc` parameter:** Returns 781-byte error page:
"无效的请求参数" (Invalid request parameters).

**With valid `enc`:** Returns full course page (~71KB) containing:

Hidden fields for homework access:

| Field | Format | Description |
|---|---|---|
| `enc` | 32-char hex | Current course token |
| `oldenc` | 32-char hex | Previous course token |
| `openc` | 32-char hex | Open course token |
| `workEnc` | 32-char hex | Homework-specific token (set by JS) |
| `examEnc` | 32-char hex | Exam-specific token |
| `courseid` | numeric | Course ID |
| `clazzid` | numeric | Class ID |
| `cpi` | numeric | Course product instance |
| `bbsid` | 32-char hex | Discussion board ID |
| `fid` | string | Institution ID |
| `userId` | numeric | User ID |

Navigation items (sidebar links):

| `dataname` | Page | URL pattern |
|---|---|---|
| `hd` | Home | `mooc1.chaoxing.com/mycourse/studentcourse` |
| `zj` | Chapters | `mooc2-ans/mycourse/studentcourse` |
| `tl` | Discussion | `groupweb.chaoxing.com/course/topic/...` |
| `zy` | **Homework** | `mooc1.chaoxing.com/mooc2/work/list` |
| `ks` | Exams | `mooc1.chaoxing.com/exam-ans/mooc2/exam/...` |
| `zl` | Materials | `mooc2-ans/coursedata/stu-datalist` |
| `cj` | Grades | `stat2-ans.chaoxing.com/study-data/...` |

### 2.3 Transfer API (Mooc1 → Mooc2 Redirect)

```
GET https://mooc1.chaoxing.com/mycourse/transfer
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `moocId` | Course ID |
| `ut` | `s` (student) |
| `clazzid` | Class ID |
| `refer` | URL-encoded target URL |

**Response (302 redirect):** Redirects to the course page URL with `cpi` and
`openc` parameters appended. The `enc` token is NOT in the redirect URL; it is
generated server-side when the target page loads.

### 2.4 Course Middle Redirect

A simpler redirect endpoint that accepts course identifiers and forwards
the browser to the correct course page (which then generates the `enc` token).

```
GET https://mooc1.chaoxing.com/visit/stucoursemiddle
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `courseid` | Course ID |
| `clazzid` | Class ID |
| `cpi` | Course-person identifier (from course list API) |
| `ismooc2` | `1` (enables mooc2 redirect) |
| `v` | `2` (version) |

**Response (302 redirect):** Redirects to the full course page on
`mooc2-ans.chaoxing.com` with `enc` generated server-side. This is the
recommended way to programmatically construct a course page URL, as it
requires no `enc` token — the server handles the generation.

---

## 3. Homework

### 3.1 Homework List (Working -- Mobile/Old Page)

```
GET https://mooc1.chaoxing.com/work/stu-work
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `ut` | `s` (student) |

**Response (200):** HTML page (~52KB) containing all homework items across all
courses. No `enc` tokens required. This is the recommended endpoint for
programmatic homework access.

**Homework item structure (in HTML):**

```html
<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/android/mtaskmsgspecial?taskrefId=53501290&msgId=0&courseId=261512194&userId=341133751&clazzId=141999697&type=work&enc_task=d0dad8876c336a0103977dc4a515b639">
    <span class="spanImg">
        <img src=".../task-work.png">
        <i class="redPoint"></i>  <!-- Red dot = unread -->
    </span>
    <div role="option">
        <p>homework title</p>
        <span class="status">status text</span>
        <span>《course name》</span>
        <span class="fr">deadline text</span>
    </div>
</li>
```

**Parsing rules:**

| Element | Extraction |
|---|---|
| Title | First `<p>` inside `<div>` |
| Status | `<span class="status">` |
| Course name | `<span>` containing `《...》` |
| Deadline | `<span class="fr">` |
| Task URL | `data` attribute on `<li>` |
| Unread indicator | Presence of `<i class="redPoint">` |

### 3.2 Homework Page (New -- Requires enc)

```
GET https://mooc1.chaoxing.com/mooc2/work/list
```

**Query parameters:**

| Parameter | Value | Source |
|---|---|---|
| `courseId` | Course ID | From `course.data[0].id` |
| `classId` | Class ID | From `content.id` |
| `cpi` | CPI number | From `content.cpi` |
| `ut` | `s` | Fixed (student) |
| `enc` | `workEnc` value | From course page hidden field |
| `stuenc` | `enc` value | From course page hidden field |
| `openc` | `openc` value | From course page hidden field |

**Response (200):** HTML page (~8.8KB) titled "作业列表" (Homework List).
Homework items are rendered server-side. Without valid enc tokens, returns a
"温馨提示" (friendly reminder) error page.

**Homework item structure:**

```html
<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=XXX&classId=XXX&cpi=XXX&workId=52900698&answerId=0&enc=XXX">
    <div class="tag icon-zy"></div>
    <div class="right-content">
        <p class="overHidden2 fl">homework title</p>
        <p class="status fl">status text</p>
    </div>
</li>
```

**Progress bar:** `<span class="progressing" style="width:X%"></span>` with
accompanying `<span>M/N</span>` showing completed/total count.

### 3.3 Homework API (Requires enc)

```
GET https://mooc1.chaoxing.com/work/getAllWork
```

Same parameters as `/mooc2/work/list`. Returns HTML page (not JSON) when
successful. Without valid `enc` and `openc`, returns error page:
"抱歉，您没有查看该页面的权限，请尝试重新登录课程" (No permission, please re-login).

### 3.4 Deprecated Homework Endpoints

```
GET https://mooc1-api.chaoxing.com/job/work?courseId=...&classId=...   [HTTP 404]
GET https://mooc1.chaoxing.com/job/work?courseId=...&classId=...       [HTTP 404]
```

These endpoints consistently return 404 across all tested courses. They appear
to have been removed from the platform.

### 3.5 Individual Homework Task

```
GET https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `courseId` | Course ID |
| `classId` | Class ID |
| `cpi` | CPI number |
| `workId` | Work item ID |
| `answerId` | Answer submission ID (`0` = not started) |
| `enc` | Task-specific enc token |

Opens the individual homework submission page.

### 3.6 Homework Answer History

```
GET /mooc-ans/mooc2/work/answer-list
```

**Query parameters:**

| Parameter | Value |
|---|---|
| `courseId` | Course ID |
| `classId` | Class ID |
| `cpi` | CPI number |
| `workId` | Work item ID |
| `answerId` | Answer ID |
| `enc` | Enc token |

Returns HTML fragment with answer submission history for a specific homework.

---

## 4. Status Codes

### 4.1 HTML Status Text → Canonical Mapping

The mobile homework page uses Chinese status text:

| HTML Status Text | Canonical | Meaning |
|---|---|---|
| `已完成` | Completed | Submitted and graded |
| `未提交` | Pending | Not yet submitted |
| `未交` | Pending | Not yet submitted (alternate text) |
| `待批阅` | Pending | Submitted, awaiting grading |
| `已批阅` | Completed | Graded (alternate text) |
| `已提交` | Pending | Submitted, not yet graded |
| `已截止` | Overdue | Deadline passed |

### 4.2 Numeric Status Codes (from deprecated `/job/work` JSON API)

| Code | Meaning |
|---|---|
| 0 | Not started |
| 1 | Completed |
| 2 | Completed |
| 3 | Overdue |

---

## 5. Error Handling

### 5.1 Captcha / IP Block Detection

When password login is blocked, the server returns HTML instead of JSON.
Detection criteria:

- Response is not valid JSON (raises `JSONDecodeError`)
- Page `<title>` contains "您所浏览的页面暂时不能访问" (Page temporarily inaccessible)
- Status code is 200 but content is HTML

**Recovery:** Switch to cookie-based authentication. Obtain a cookie string
from browser DevTools and set it in the configuration.

### 5.2 Cookie Expiry Detection

The following conditions indicate an expired or invalid cookie:

1. **Redirect to login page:** Response URL contains `passport2.chaoxing.com/login`
   or `passport.chaoxing.com/login`.

2. **Login page in response body:** Non-JSON response containing "passport"
   and "login" in the first 500 characters.

3. **API auth error:** JSON response with `"result": 0` and message containing
   "unauthorized" or "请登录" (please login).

**Recovery:** Clear the cookie, clear session state, re-authenticate with
phone/password, retry the original request.

### 5.3 General Error Pages

| Page Title | Meaning |
|---|---|
| "您所浏览的页面暂时不能访问" | IP blocked or captcha required |
| "温馨提示" | Generic error / permission denied |
| "无效的请求参数" | Missing required parameter (usually `enc`) |
| "404" | Endpoint not found (deprecated/moved) |

---

## 6. Authentication Token System

### 6.1 Token Types

| Token | Format | Scope | Source |
|---|---|---|---|
| `enc` | 32-char hex | Per-course, per-session | Generated server-side; required in mooc2-ans course page URL |
| `oldenc` | 32-char hex | Previous session enc | Course page hidden field |
| `openc` | 32-char hex | Cross-session course access | Returned by transfer API redirect |
| `workEnc` | 32-char hex | Homework tab access | Set by JS on course page; derived from `enc` |
| `examEnc` | 32-char hex | Exam tab access | Set by JS on course page |
| `stuenc` | 32-char hex | Student verification | Same value as `enc`, passed as separate parameter |

### 6.2 enc Generation

The `enc` token is generated **server-side** when the course page is loaded.
Attempts to compute it client-side (via MD5 of courseId+clazzid+cpi+userId,
or similar combinations) have not been successful. The token likely includes
a server-side secret key or salt.

**How to obtain enc:**

1. Login with valid credentials
2. Navigate to the course from the Chaoxing course list in a browser
3. The platform redirects to the mooc2-ans course page with `enc` in the URL
4. Extract `enc` from the URL or from the page's hidden `<input>` fields

For the mobile/old homework endpoint (`/work/stu-work`), no enc tokens are
required -- it uses cookie-based authentication only.

### 6.3 fid Values

| fid | Context |
|---|---|
| `503` | Standard login / most course access |
| `12` | Mooc1 course page redirect (appears in transfer API redirect loop) |
| `-1` | Default/no institution (used by deprecated login endpoint) |

### 6.4 User ID

Extracted from cookies: `UID` or `_uid` cookie value.
Example: `341133751`.

---

## 7. Endpoint Summary

| # | Endpoint | Method | Status | Requires | Returns |
|---|---|---|---|---|---|
| 1 | `/login` (login page) | GET | Active | None | HTML + session cookies |
| 2 | `/fanyalogin` | POST | Active | AES(phone+pwd) | JSON (status + redirect URL) |
| 3 | `/fanya/login` | POST | Deprecated | AES(phone) only | JSON (blocked by IP) |
| 4 | `/mycourse/backclazzdata` | GET | Active | Cookie | JSON (course list) |
| 5 | `/mycourse/transfer` | GET | Active | Cookie | 302 redirect (openc in URL) |
| 6 | `/visit/stucoursemiddle` | GET | Active | Cookie | 302 redirect (course page) |
| 7 | `/mooc2-ans/mycourse/stu` | GET | Active | Cookie + enc | HTML (course page) |
| 8 | `/work/stu-work` | GET | Active | Cookie | HTML (homework list) |
| 9 | `/mooc2/work/list` | GET | Active | Cookie + enc | HTML (homework page) |
| 10 | `/work/getAllWork` | GET | Active | Cookie + enc | HTML (homework data) |
| 11 | `/job/work` | GET | **404** | — | Endpoint removed |
| 12 | `/mooc-ans/mooc2/work/task` | GET | Active | Cookie + enc | HTML (homework detail) |
| 13 | `/mooc-ans/mooc2/work/answer-list` | GET | Active | Cookie + enc | HTML (answer history) |

---

## 8. Common Headers

All requests should include:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Login requests additionally require:

```
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: <login page URL>
```

Course/homework requests work with just the `User-Agent` header.
Adding `Referer` with the course page URL may help prevent access-denied errors
on some endpoints.
