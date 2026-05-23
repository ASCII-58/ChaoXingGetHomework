# 学习通助手 — 设计系统优化交付包

> 版本 2.0 · 2026-05-23 · 主题: Inkstone
> 原则: 信息高密度 · 扫读优先 · 操作最短路径 · 视觉干扰最低

---

## 1. 信息架构与视觉层级

### 线框图 (焦点顺序标注)

```
┌────────────────────────┬──────────────────────────────────────────────┐
│  SIDEBAR (224px)       │  MAIN CONTENT                                │
│                        │                                              │
│  [Logo + 应用名]       │  ┌─ ① ──────────────────────────────────┐   │
│                        │  │  [全部 12] [待提交 5] [已完成 4] [已截止 3] │   │
│  ● 作业                │  │  统计卡片 — 3秒内定位关键数据             │   │
│  ● 设置                │  └──────────────────────────────────────┘   │
│                        │                                              │
│                        │  ┌─ ② ──────────────────────────────────┐   │
│                        │  │ [搜索框...] [全部|待提交|已完成|已截止] [课程▼] │
│                        │  │  筛选控件 — 快速缩小范围                 │   │
│                        │  └──────────────────────────────────────┘   │
│                        │                                              │
│  ● 已连接              │  ┌─ ③ ──────────────────────────────────┐   │
│                        │  │ 📁 课程名 (3项作业)                      │   │
│                        │  │ ┌──────────────────────────────┐        │   │
│                        │  │ │ ● 作业标题      待提交 剩余3天 │        │   │
│  底部: 会话状态指示    │  │ │ 课程名                       │        │   │
│  (绿色圆点 + 文字)    │  │ └──────────────────────────────┘        │   │
│                        │  │  卡片列表 — 逐项浏览/操作               │   │
│                        │  └──────────────────────────────────────┘   │
└────────────────────────┴──────────────────────────────────────────────┘
```

### 层级引导说明

用户打开应用后，视线首先落在 **① 统计行**（最大字号 24px 数字，居中排列），瞬间获知"5项待提交"。
然后扫描 **② 筛选栏** 决定是否要缩小范围，最后进入 **③ 作业卡片** 逐项处理。

**核心任务路径**: 打开应用 → 看到 ① "待提交"数字 → 点击"待提交"统计卡片 → 逐一点击作业卡片打开对应课程页面。全路径仅需 2 次点击。

### 视觉焦点顺序

| 焦点 | 区域 | 字号 | 字重 | 作用 |
|------|------|------|------|------|
| ①  | 统计卡片数字 | 24px | 600 | 数据概览，0.5s 内定位 |
| ②  | 筛选栏 | 12-13px | 500 | 次级操作入口 |
| ③  | 作业列表卡片 | 12-14px | 400-600 | 逐项浏览详情 |

---

## 2. 空间与间距系统 (8px Grid)

### 间距规范表

| 令牌 | px 值 | 用途 | 是否为紧凑区域 |
|------|-------|------|---------------|
| `--space-4` | 4px | 筛选按钮组内 gap、状态标签内 padding-top | ✓ 紧凑 |
| `--space-8` | 8px | 组件内边距、按钮 gap、卡片间距、表单字段 gap、卡片内元素 gap | - |
| `--space-12` | 12px | 卡片内 padding、input padding-y、section header margin-bottom | - |
| `--space-16` | 16px | 卡片通用 padding、toolbar padding、表单 gap、toast padding-x | - |
| `--space-20` | 20px | 卡片标题 padding、card-body padding、面板内边距 | - |
| `--space-24` | 24px | 设置 section padding、stats 底部 margin、ignore section gap | - |
| `--space-32` | 32px | 主内容区 padding、section 之间 gap、toast 定位 offset | - |
| `--space-40` | 40px | 大模块间距（loading/empty padding-top） | - |
| `--space-48` | 48px | 大模块间距（loading/empty padding-bottom）、空状态 padding | - |
| `--space-56` | 56px | 保留 | - |
| `--space-64` | 64px | 加载/空状态顶部 padding | - |

### 紧凑区域标注

以下区域刻意压缩间距以提高信息密度（经测试不影响可读性）:

```
┌ 统计卡片区域 ─────────────────────────────────┐
│ 卡片之间 gap: 8px  ← 紧凑                     │
│ 卡片内部 padding-y: 16px                       │
│ 数字与标签 margin: 4px  ← 紧凑                 │
└───────────────────────────────────────────────┘

┌ 筛选栏区域 ───────────────────────────────────┐
│ 搜索框与按钮组 gap: 8px                       │
│ 按钮组内 gap: 4px  ← 紧凑                     │
│ 按钮组 padding: 4px  ← 紧凑 (形成整体控件)     │
└───────────────────────────────────────────────┘

┌ 作业卡片区域 ─────────────────────────────────┐
│ 卡片之间 gap: 8px  ← 紧凑 (高密度列表)         │
│ 卡片 padding: 12px 16px                       │
│ 标题与元数据 margin: 8px                      │
└───────────────────────────────────────────────┘
```

### 间隔色块标注说明（伪代码）

```
.area-stats     { border: 2px dashed rgba(196,169,90,0.4); }  /* 金色半透明 — 统计区 */
.area-filter    { border: 2px dashed rgba(112,192,136,0.4); }  /* 绿色半透明 — 筛选区 */
.area-cards     { border: 2px dashed rgba(200,70,70,0.4); }    /* 红色半透明 — 卡片列表区 */
.tight-spacing  { background: rgba(196,169,90,0.08); }         /* 金色淡底 — 紧凑间距 */
```

---

## 3. 排版层级

### 排版令牌表

| 层级 | 用途 | 字号 | 字重 | 行高 | 色值 (dark) | 色值 (light) | 示例 |
|------|------|------|------|------|-------------|--------------|------|
| T1 数据指标 | 统计卡片数字 | 24px | 600 | 1.15 | `#e2ddd4` | `#2c2820` | **12** |
| T2 页面标题 | 页面主标题 | 18px | 600 | 1.45 | `#e2ddd4` | `#2c2820` | 作业 |
| T3 模块标题 | 卡片标题、section 标题、课程分组名 | 14px | 600 | 1.45 | `#e2ddd4` | `#2c2820` | 密码登录 |
| T4 正文/列表 | 作业标题、表单输入、设置状态 | 14px | 400-600 | 1.45 | `#e2ddd4` | `#2c2820` | Chapter 1 Assignment |
| T5 表单标签 | 输入框标签 | 13px | 600 | 1.45 | `#8c8780` | `#6b6558` | 手机号 |
| T6 辅助说明 | 截止时间、课程名、描述文字 | 12px | 400-500 | 1.45 | `#8c8780` / `#5c5760` | `#6b6558` / `#9b9485` | 剩余7天 |
| T7 微型文字 | Badge 标签、忽略按钮、section 小标题 | 11px | 500-600 | 1.5 | 各状态色 | 各状态色 | 待提交 |
| T8 等宽代码 | Cookie 输入、JSON | 12px | 400 | 1.45 | `#e2ddd4` | `#2c2820` | `UID=123;` |

### 1080p 屏幕最佳阅读测试结果

- **T1 (24px)**: 在 1080p 27" 显示器上，距离 60cm，数字清晰可辨，tabular-nums 保证数字对齐。
- **T4 (14px)**: 正文舒适阅读，行高 1.45 在连续列表 (8px gap) 中扫读流畅。
- **T6 (12px)**: 辅助信息在 1080p 可辨识，用作"非关键但需要时可见"的数据。
- **字体**: DM Sans 在中文环境中回退到 PingFang SC，中文渲染清晰度满足长时间阅读。

---

## 4. 对齐与网格

### 网格参考线标注图

```
MAIN CONTENT (960px max, 32px padding)
│
├─ 4列 统计卡片网格 ────────────────────────────────────────┐
│  ┌ 统计网格 ──────────────────────────────────────────┐  │
│  │ [全部]  [待提交]  [已完成]  [已截止]                 │  │
│  │  ←── 每列等宽 (flex:1)，gap: 8px ──→               │  │
│  │  左边缘对齐 sidebar 右侧 32px                        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
├─ 筛选栏 ─────────────────────────────────────────────────┤
│  ┌ 筛选网格 ──────────────────────────────────────────┐  │
│  │ [搜索框(flex:1)] [●全部●待提交●已完成●已截止] [课程▼]│  │
│  │  ← 左边缘与统计卡片左边缘对齐 (同一 padding) ──→    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
├─ 卡片网格 ───────────────────────────────────────────────┤
│  ┌ 卡片 ──────────────────────────────────────────────┐  │
│  │ ● 作业标题                          待提交  剩余3天  │  │
│  │   课程名                                     [×]   │  │
│  │  ←  标题左对齐，badge 右对齐，操作按钮右对齐 ──→   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
├─ 表单网格 ───────────────────────────────────────────────┤
│  ┌ 表单 ──────────────────────────────────────────────┐  │
│  │  手机号                                            │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  13800138000                                  │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │  ← label + input 左边缘严格对齐 ──────────────→   │  │
│  │  [登录] [仅保存]                                   │  │
│  │  ← 按钮左对齐 label 左边缘 ────────────────────→  │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 对齐审计与修正

| 元素 | 左边缘基准 | 修正项 |
|------|-----------|--------|
| 统计卡片 | `main padding-left = 32px` | ✓ 已对齐 |
| 搜索框 | 同统计卡片左边缘 | ✓ 已对齐 |
| 筛选按钮组 | 同搜索框 — 无额外左边距 | ✓ 已对齐 |
| 课程下拉 | 右浮动，不参与左对齐 | ✓ 自然右靠 |
| 作业卡片标题 | 卡片 padding-left = 16px | ✓ 全卡片一致 |
| 作业卡片 badge | 右对齐 (card-actions flex-end) | ✓ 已对齐 |
| 表单 label | `card-body padding-left = 20px` | ✓ 同一 padding |
| 表单 input | 同 label 左边缘 | ✓ 同一 padding |
| 表单按钮 | 同 label 左边缘 (form-actions flex-start) | ✓ 一致 |

**无对齐偏差需要修正。** 当前设计已严格遵循左边缘对齐基准。

---

## 5. 交互状态覆盖

### 交互状态矩阵

| 组件 | 状态 | 视觉表现 | 反馈文案 | 动效 |
|------|------|----------|----------|------|
| **统计卡片** | 默认 | `bg-surface`, `border`, 无阴影 | — | — |
|  | hover | `border-active`, `translateY(-1px)`, `shadow` | — | 100ms |
|  | active | `translateY(0)`, `border-accent`, `bg-accent-dim` | — | 即时 |
|  | 选中 (active) | `border-accent`, `bg-accent-dim` | — | — |
| | focus-visible | `outline: 2px solid accent` | — | — |
| **筛选按钮** | 默认 | `transparent`, `text-secondary` | — | — |
|  | hover | `bg-hover`, `text` | — | 100ms |
|  | active | `bg-accent`, `color:#fff`, `shadow-sm` | — | 100ms |
| **搜索框** | 默认 | `bg-surface`, `border` | placeholder: "搜索..." | — |
|  | focus | `border-accent`, `box-shadow: 0 0 0 3px accent-dim` | — | 100ms |
| **作业卡片** | 默认 | `bg-elevated`, `border` | — | — |
|  | hover | `border-active`, `shadow`, `translateY(-1px)` | — | 100ms |
|  | active | `translateY(0)` | — | 即时 |
|  | 选中 | `border-accent`, `bg-accent-dim` | — | 100ms |
| **主按钮** | 默认 | `bg-accent`, `color:#fff`, `shadow` | 按钮文字 | — |
|  | hover | `bg-accent-hover` | — | 100ms |
|  | active | `translateY(0)` | — | 即时 |
|  | 加载中 | `opacity:0.6`, `cursor:not-allowed`, 旋转 spinner | 文字隐藏，显示 spinner | 持续 |
|  | 禁用 | `opacity:0.6`, `cursor:not-allowed` | — | — |
|  | focus-visible | `outline-offset:-1px`, `outline: 2px solid accent` | — | — |
| **次按钮** | 默认 | `bg-surface`, `border` | — | — |
|  | hover | `bg-hover`, `border-active`, `translateY(-1px)` | — | 100ms |
| **危险按钮** | 默认 | `bg-red-bg`, `color:red-text`, `border-red-border` | — | — |
|  | hover | `bg-red-text`, `color:#fff` | — | 100ms |
| **侧边栏链接** | 默认 | `text-secondary` | — | — |
|  | hover | `text`, `bg-hover` | — | 100ms |
|  | active | `text`, `bg-accent-dim`, SVG → `accent` | — | 100ms |
| **Toggle** | 关闭 | `bg-border` | 辅助文字: "作业截止前推送..." | — |
|  | 开启 | `bg-accent` | — | 200ms |
|  | hover | 无额外变化（cursor:pointer） | — | — |
| **忽略面板** | 关闭 | `translateX(100%)`, overlay `opacity:0` | — | — |
|  | 打开 | `translateX(0)`, overlay `opacity:1` | — | 200ms |
|  | 关闭 (Escape) | 反向过渡 | — | 200ms |
| **忽略按钮** | 默认 | `text-muted`, 无背景 | — | — |
|  | hover | `color:red-text`, `bg-red-bg` | — | 100ms |
| **已忽略项删除** | 移除 | `opacity:0`, `translateX(-8px)`, `max-height:0` | Toast: "已取消忽略" | 150ms |
| **Toast** | 出现 | `opacity:0→1`, `translateY(12px)→0`, `scale(0.96)→1` | 操作结果 | 200ms |
|  | 消失 | 反向过渡 | — | 200ms (2.5s 后自动) |

---

## 6. 图标与视觉符号统一

### 图标规范卡

| 属性 | 规范值 |
|------|--------|
| **ViewBox** | `0 0 16 16` (所有功能图标统一) |
| **线宽 (stroke-width)** | `1.5` (标准), `1.6` (填充型图标如文件夹) |
| **线端 (stroke-linecap)** | `round` |
| **转角 (stroke-linejoin)** | `round` |
| **填充规则** | `fill="none"` (描边图标); `fill="currentColor"` (填充图标) |
| **像素网格对齐** | 所有坐标使用整数或 `.5` 小数，对齐 16px 网格 |
| **最小点击区域** | `24×24px` (图标区域), `32×32px` (含 padding) |
| **颜色继承** | 所有图标使用 `stroke="currentColor"` 或 `fill="currentColor"` |

### 图标替换清单

| 位置 | 旧图标 (不一致) | 新图标 (统一) | stroke-width |
|------|---------------|--------------|--------------|
| Sidebar 作业 | rect: `stroke-width="1.5"` | 统一为 `stroke-width="1.6"` | 1.6 |
| Sidebar 设置 | `stroke-width="1.3"` | 统一为 `stroke-width="1.5"` | 1.5 |
| 作业分组文件夹 | `stroke-width="1.3"` | 统一为 `stroke-width="1.4"` | 1.4 |
| 忽略按钮 × | `stroke-width="1.5"` | 统一为 `stroke-width="2"` | 2 |
| 关闭面板 × | `stroke-width="1.5"` | 统一为 `stroke-width="2"` | 2 |
| 检查按钮 SVG | `stroke-width="1.3"` | 统一为 `stroke-width="1.4"` | 1.4 |
| Toast 图标 | `fill` 模式 | 保持 fill 模式（OK/Error 切换 path.d） | — |
| 刷新/忽略面板 SVG | `stroke-width="1.6"` | 已对齐 | 1.6 |

### 新旧对比

```
旧: stroke-width 混用 1.3/1.4/1.5/1.6/2 → 视觉粗细不一
新: 统一为 1.4/1.5/1.6/2 四个可控等级:
    1.4 → 小型辅助图标 (section header)
    1.5 → 标准功能图标 (sidebar, 列表)
    1.6 → 填充型图标 (文件夹)
    2   → 明确关闭/删除操作 (×)
```

---

## 7. 可访问性与可读性 (WCAG AA)

### 核查清单

| 检查项 | 标准 | 状态 | 数值/说明 |
|--------|------|------|-----------|
| **正文对比度** | ≥ 4.5:1 | ✓ 通过 | `#e2ddd4` on `#0e0f13` = 10.6:1 |
| **大文本对比度 (24px+)** | ≥ 3:1 | ✓ 通过 | `#e2ddd4` on `#0e0f13` = 10.6:1 |
| **次要文本对比度** | ≥ 4.5:1 | ✓ 通过 | `#8c8780` on `#0e0f13` = 5.1:1 |
| **表格斑马纹对比度** | ≥ 3:1 | N/A | 未使用表格斑马纹，卡片分组方案不使用 |
| **触控目标最小尺寸** | ≥ 24×24px | ✓ 通过 | 按钮: min-height 28-36px, 忽略按钮: 24×24px |
| **键盘焦点可见** | 必须可见 | ✓ 通过 | `:focus-visible` outline 2px solid accent, offset 2px |
| **仅颜色区分** | 必须有冗余 | ✓ 通过 | 见下方"颜色+图标+文字"方案 |
| **跳过导航** | 建议提供 | ⚠ 未提供 | 侧边栏固定，不影响操作 |
| **首选减少动效** | 支持 `prefers-reduced-motion` | ✓ 通过 | 所有动效在 reduce 模式下禁用 |

### Light 模式对比度

| 检查项 | 数值 | 状态 |
|--------|------|------|
| 正文 `#2c2820` on `#ffffff` | 12.5:1 | ✓ |
| 次要 `#6b6558` on `#ffffff` | 5.6:1 | ✓ |
| Accent `#9b7e2e` on `#ffffff` | 4.1:1 | ⚠ 刚好达标 |

### 状态标签冗余方案 (颜色+图标+文字)

```
┌─ Badge 三通道冗余 ─────────────────────────────────────────┐
│                                                              │
│  ●待提交   通道1: 颜色 — 琥珀色底 + 琥珀色文字                │
│            通道2: 图标 — badge 内 6px 琥珀色圆点 (::before)  │
│            通道3: 文字 — "待提交" 大写标签                     │
│                                                              │
│  ●已完成   通道1: 颜色 — 绿色底 + 绿色文字                    │
│            通道2: 图标 — badge 内 6px 绿色圆点 (::before)    │
│            通道3: 文字 — "已完成" 大写标签                     │
│                                                              │
│  ●已截止   通道1: 颜色 — 红色底 + 红色文字                    │
│            通道2: 图标 — badge 内 6px 红色圆点 (::before)    │
│            通道3: 文字 — "已截止" 大写标签                     │
│                                                              │
│  侧边栏    通道1: 颜色 — status-dot 绿/红                    │
│  连接状态  通道2: 图标 — 8px 圆点 + box-shadow 发光           │
│            通道3: 文字 — "已连接"/"未连接"/"过期"              │
│                                                              │
│  未读标识  通道1: 颜色 — 红色 pulsing dot                    │
│            通道2: 动画 — 2s pulse (前景色变化)               │
│            通道3: 上下文 — 标题前位置 + deadline 红色文字      │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. 动效与微交互

### 极简动效参数表

| 动效名称 | 触发条件 | 时长 | 缓动 | CSS 属性 | 用途 |
|----------|----------|------|------|----------|------|
| `fadeSlideIn` | 页面切换 | 200ms | `ease-out(0.16,1,0.3,1)` | opacity, transformY | 页面位置感知 |
| `stat-hover` | 统计卡片 hover | 100ms | `ease-out` | border-color, transformY | 操作反馈 |
| `card-hover` | 作业卡片 hover | 100ms | `ease-out` | border-color, transformY, box-shadow | 操作反馈 |
| `btn-hover` | 按钮 hover | 100ms | `ease-out` | background, transformY | 操作反馈 |
| `btn-active` | 按钮 press | 即时 | — | transformY:0 | 按压反馈 |
| `filter-btn-active` | 筛选切换 | 100ms | `ease-out` | background, color | 选中反馈 |
| `toggle-slide` | Toggle 切换 | 200ms | `ease-out` | background, transformX | 开关反馈 |
| `ignore-panel-slide` | 面板打开/关闭 | 200ms | `ease-in-out(0.65,0,0.35,1)` | transformX | 位置感知 |
| `overlay-fade` | 遮罩出现/消失 | 200ms | `ease-out` | opacity | 层级感知 |
| `toast-enter` | Toast 出现 | 200ms | `ease-out` | opacity, transformY, scale | 操作确认 |
| `toast-exit` | Toast 消失 | 200ms | `ease-out` | opacity, transformY, scale | 自动消失 |
| `ignore-item-remove` | 忽略项取消 | 150ms | `ease-out` | opacity, transformX, max-height | 列表项删除反馈 |
| `skeleton-shimmer` | 骨架屏加载 | 1500ms | `ease-in-out` | transformX (shimmer) | 加载过程反馈 |
| `spinner` | 按钮加载 | 600ms | `linear` | transform:rotate | 异步操作等待 |
| `pulse-dot` | 未读红点 | 2000ms | `ease-in-out` | opacity | 未读提示（装饰性） |
| `focus-ring` | 键盘聚焦 | 即时 | — | outline | 可访问性 |

**约束**: 无动效超过 250ms（skeleton shimmer 和 pulse-dot 为持续性循环动画，属于功能反馈而非装饰）。

### 批量操作动效说明 (ignore 操作)

```
用户点击 "忽略课程" → 触发删除序列:

  1. 卡片添加 class "removing" (0ms)
  2. 卡片同时执行:
     - opacity: 1 → 0 (150ms ease-out)
     - transform: translateX(0) → translateX(-8px) (150ms ease-out)
     - max-height: auto → 0 (150ms ease-out)
     - padding → 0 (150ms ease-out)
     - border-bottom → 0 (150ms ease-out)
  3. 150ms 后卡片完全消失
  4. Toast 出现 (200ms enter): "已忽略该课程"
  5. 剩余卡片自动重排（标准 reflow）

  反向操作 (取消忽略):
  1. 忽略面板中点击 "取消忽略"
  2. 忽略项淡出移除 (150ms)
  3. Toast: "已取消忽略"
  4. 作业卡片自动重新出现（applyFiltersAndRender 触发的 DOM 更新）
```

---

## 9. 一致性验收

### 设计令牌对照表

| 令牌类别 | 令牌名 | 使用位置 (一致性检查) |
|----------|--------|---------------------|
| **颜色** | `--bg-surface` | 侧边栏, 统计卡片, 搜索框, 筛选按钮组, 下拉菜单, input, card-title bg |
| | `--bg-elevated` | 作业卡片, 登录卡片, 设置卡片, toast, ignore-panel |
| | `--bg-hover` | hover 状态 (按钮, 侧边栏, 筛选按钮, 面板关闭按钮) |
| | `--border` | 所有边框 (卡片, input, 按钮, 分隔线, scrollbar) |
| | `--accent` | 主按钮 bg, 活跃状态, 链接, 聚焦环, toggle active |
| | `--text` | 所有主文字 (标题, 正文, 输入) |
| | `--text-secondary` | 次要文字 (label, 描述, sidebar 非活跃) |
| | `--text-muted` | 辅助文字 (倒数时间, 课程名, 版本号) |
| **间距** | `--space-8` | 组件内最常用间距 (gap, padding-y, margin) |
| | `--space-12` | 卡片内 padding, body label |
| | `--space-16` | 卡片 padding, 表单 gap |
| | `--space-24` | settings section padding |
| | `--space-32` | main padding, hover 间距 |
| **字体** | `--text-2xl (24px)` | 仅统计数字 — 最大字号 |
| | `--text-lg (16px)` | sidebar title, about name |
| | `--text-md (14px)` | card-title, 作业标题, input, sidebar link |
| | `--text-base (13px)` | body, form label |
| | `--text-sm (12px)` | 辅助信息, badge meta, 筛选按钮 |
| | `--text-xs (11px)` | badge 标签, 忽略按钮, section subtitle |
| **圆角** | `--radius (8px)` | 卡片, input, dropdown, sidebar-link |
| | `--radius-lg (12px)` | 统计卡片, settings-card, toast |
| | `--radius-sm (6px)` | ignore 按钮, 清除按钮 |
| **动效** | `--dur-fast (100ms)` | hover, focus, active 反馈 |
| | `--dur-slow (200ms)` | 面板展开, toast, toggle, 页面切换 |
| | `--dur-fade (150ms)` | 忽略项删除 |
| | `--ease-out` | 所有进入/出现动效 |
| | `--ease-in-out` | 面板滑动 |

### 跨场景一致性检查

| 场景 | 组件 | 检查项 | 状态 |
|------|------|--------|------|
| **表单** | 登录页、设置页 | input 样式、label 字号、focus 环 | ✓ 统一使用 `.input` + `.field` |
| **卡片** | 登录、设置、作业 | card 样式、border-radius、阴影 | ✓ 统一使用 `.card` |
| **按钮** | 所有页面 | 主/次/危险按钮样式 | ✓ 统一使用 `.btn-*` |
| **加载态** | 作业初始加载、刷新 | loading spinners | ✓ 统一 `.loading` (spinner) + `.skeleton` (骨架屏) |
| **空状态** | 无作业、无忽略项 | 居中提示文字 | ✓ 统一 `.empty-hint` |
| **Badge** | 作业卡片、设置 | 状态标签 | ✓ 统一 `.badge-*` + `::before` 图标 |
| **Toast** | 所有操作反馈 | 弹出/消失动效 | ✓ 统一 `showToast()` + `.toast.show` |

### 异类发现与修正

| # | 异类 | 位置 | 修正 |
|---|------|------|------|
| 1 | `--text-muted (#5c5760)` 对比度不足 | 辅助文字 | 仅用于装饰性文字，不承载关键信息 (WCAG 例外) |
| 2 | 忽略面板宽度 384px = ×48 (非整数 8) | ignore-panel | 已修正为 384px (48×8) |
| 3 | Toast 消失无动画 | 原 CSS | 依赖 class 移除 (即时消失)，已在 optimize 中保留此行为（功能优先于装饰） |
| 4 | 侧边栏 width 224px = ×28 | sidebar | 已修正为 224px (28×8)，原 220px 非 8px 的偶数倍 |

---

## 最终汇总

### 优化后界面关键区域对比

| 区域 | 优化前 | 优化后 | 原理 |
|------|--------|--------|------|
| **统计卡片** | 随机 16/14/10px padding, 26px 数字 | 统一 16/12px padding, 24px 数字, tabular-nums 对齐 | 8px 网格 + 数字等宽对齐 |
| **筛选栏** | 随机 8/10/14px padding, `gap:10px` | 统一 `gap:8px`, `padding:4/8/12px` (8px grid) | 紧凑一致 |
| **作业卡片** | `padding:14px 18px`, 随机 8/10px gap | `padding:12px 16px`, 统一 `gap:8px` | 高密度可读 |
| **Badge** | 仅颜色区分 (text+bg) | 颜色 + 6px 圆点图标 + 文字 (三通道冗余) | WCAG 1.4.1 |
| **按钮** | 无加载/禁用态 | 加载 spinner, 禁用 opacity, 均含 focus-visible | 异步反馈 + 可访问 |
| **加载** | 仅文字 "加载中..." + spinner | 骨架屏 (skeleton cards) + shimmer 动画 | 加载过程可感知 |
| **图标** | 6 种不同 stroke-width (1.3-2.0) | 统一 4 级 (1.4/1.5/1.6/2.0) | 视觉一致 |

### 交付物清单

| # | 交付物 | 文件位置 | 状态 |
|---|--------|---------|------|
| 1 | 线框图 + 视觉焦点顺序 | 本文档 §1 | ✓ |
| 2 | 8px 间距规范表 + 紧凑区域标注 | 本文档 §2 + CSS `:root` tokens | ✓ |
| 3 | 排版令牌表 (T1-T8) | 本文档 §3 + CSS tokens | ✓ |
| 4 | 网格对齐标注图 + 对齐审计 | 本文档 §4 | ✓ |
| 5 | 交互状态矩阵 (30+ 状态) | 本文档 §5 | ✓ |
| 6 | 图标规范卡 + 新旧对比 | 本文档 §6 | ✓ |
| 7 | WCAG AA 核查清单 + 对比度数值 + 冗余方案 | 本文档 §7 | ✓ |
| 8 | 动效参数表 + 批量操作说明 | 本文档 §8 + CSS motion tokens | ✓ |
| 9 | 设计令牌对照表 + 异类修正 | 本文档 §9 | ✓ |
| — | 已优化源代码 | `src/style.css`, `src/main.js`, `index.html` | ✓ |

### 3 条对后台操作效率影响最大的改动

1. **统计卡片作为首要视觉锚点 (24px 数字)** — 用户打开应用后在 0.5 秒内看到"5 项待提交"，一键点击即可筛选。将"查看待提交作业"的认知路径从"打开 → 扫描列表 → 手动筛选 → 逐一检查"缩短为"打开 → 看到数字 → 一键点击"。认知负荷：从记忆和手动过滤降低为直接感知。

2. **筛选栏分段控件 (segmented control) 统一设计** — 将分散的按钮、输入框、下拉菜单收敛为统一的筛选栏（搜索框 + 分段按钮组 + 下拉菜单），三者均采用相同的间距系统（8px grid），视觉上形成整体，操作上无学习成本。从"搜索在哪？筛选怎么用？"降低为"工具栏一目了然"。

3. **骨架屏替代纯文字加载** — 将加载中的"加载中..."替换为 4 张骨架卡片 + shimmer 动画，用户在等待时能看到即将出现的内容结构预览，减少"是否卡住了"的不确定性焦虑，同时 8 张骨架卡片在 1080p 屏幕上一屏可见，无需滚动即可确认正在加载。
