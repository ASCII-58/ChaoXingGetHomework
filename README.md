# 学习通助手

桌面 GUI 应用，获取超星学习通作业列表，并在截止前推送系统通知。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri](https://tauri.app/) (Rust) |
| 前端 | Vite + Vanilla JS |
| HTTP | reqwest |
| 加密 | AES-128-CBC |
| 测试 | Vitest |
| 代码检查 | ESLint |

## 功能

- 密码登录 / Cookie 登录
- 作业列表（按课程分组，支持搜索和状态筛选）
- 截止时间前 1 天推送桌面通知
- 忽略特定课程或作业
- 设置页管理 Cookie、手机号、通知开关

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（仅前端）
npm run dev

# Tauri 桌面开发
npm run tauri

# 生产打包
npm run tauri:build
```

## 命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务器 (port 5173) |
| `npm run build` | Vite 生产构建 → `dist/` |
| `npm test` | 运行所有测试 |
| `npm run tauri` | Tauri 开发窗口 |
| `npm run tauri:build` | Tauri 生产打包 |
| `npx vitest run tests/login.test.js` | 运行单个测试文件 |

## 项目结构

```
├── index.html              # 入口 HTML
├── src/
│   ├── main.js             # 前端主逻辑（路由、渲染、事件）
│   ├── style.css           # 样式表
│   ├── router.js           # Hash 路由
│   ├── login.js            # 登录加密（JS 版，仅用于测试）
│   ├── tauri-login.js      # Tauri 命令封装
│   └── homework.js         # 作业列表逻辑
├── tests/
│   ├── login.test.js       # 登录测试
│   └── homework.test.js    # 作业测试
├── src-tauri/
│   ├── src/main.rs         # Rust 后端（HTTP 请求、配置持久化）
│   ├── Cargo.toml
│   └── tauri.conf.json
├── API.md                  # 超星 API 文档
├── AGENTS.md               # 开发约定
└── REQUIREMENTS.md          # 前端需求规格
```

## 配置存储

Rust 后端将配置和数据持久化到 `dirs::data_dir()/xxt/`：
- `config.json` — 手机号、Cookie、通知开关
- `data.json` — 忽略列表、已通知 ID、缓存数据

## 许可证

[MIT](LICENSE)
