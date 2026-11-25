# WebProgram 本地 Web 项目集合

本目录用于集中存放本地 Web 应用项目及配套的启动/停止脚本。

## 目录结构

```text
webprogram/
├── douyin-local/                  # 抖音本地沉浸版（前端 + Node 本地媒体服务）
├── tesla-dashcam/                 # 特斯拉行车记录仪播放器（纯前端车机模拟器）
├── 启动-抖音本地版.bat             # 一键启动 douyin-local 并打开浏览器
├── 停止-抖音本地版.bat             # 一键停止 douyin-local 相关后台进程
├── 开机静默启动-抖音本地版.vbs      # 无黑框静默启动 douyin-local 后端服务
├── 启动-特斯拉行车记录仪.bat        # 一键启动 tesla-dashcam 并打开浏览器
├── 停止-特斯拉行车记录仪.bat        # 一键停止 tesla-dashcam 相关后台进程
└── README.md
```

---

## 应用介绍

### 1. 抖音本地沉浸版 (`douyin-local`)

- **默认访问地址**：`http://127.0.0.1:3002/`
- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + Node.js (`server/index.mjs`)
- **核心功能**：
  - **本地媒体库索引**：读取本地下载目录（默认 `J:\GitProject\DouzyDownload`，可通过环境变量 `DOUYIN_MEDIA_ROOT` 指定），支持视频与图文作品。
  - **沉浸式信息流与浏览**：支持推荐流、我的关注、图文精选、标签（`#tag`）筛选、合集播放以及关键词搜索。
  - **作者主页抽屉**：点击作者可查看其作品列表并切换播放/关注。
  - **本地状态持久化**：点赞、收藏、关注、观看历史与推荐权重会保存在 `douyin-local/server/user-state.json`。

### 2. 特斯拉行车记录仪 (`tesla-dashcam`)

- **默认访问地址**：`http://127.0.0.1:3000/`
- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS
- **核心功能**：
  - **仿特斯拉车机桌面**：包含顶部状态栏、底部 Dock、深浅色主题切换及车机设置弹窗。
  - **多路行车记录仪回放**：内置 4 路同步演示数据，支持哨兵模式（Sentry）等事件浏览与删除。
  - **本地 U 盘导入**：支持直接导入本地特斯拉行车记录仪文件夹进行事件解析与回放，也可随时恢复内置演示数据。

---

## 使用方式

### 方式一：双击一键脚本（推荐）

- **启动应用**：
  - 双击 `启动-抖音本地版.bat`：启动 Node 服务（端口 `3002`）并自动在浏览器打开 `http://127.0.0.1:3002/`；若服务已在运行则会直接打开页面。
  - 双击 `启动-特斯拉行车记录仪.bat`：启动预览服务（端口 `3000`）并自动在浏览器打开 `http://127.0.0.1:3000/`。
  - 双击 `开机静默启动-抖音本地版.vbs`：在后台无窗口静默运行 `douyin-local` 服务（可放入 Windows 启动项）。
- **停止应用**：
  - 双击 `停止-抖音本地版.bat` 或 `停止-特斯拉行车记录仪.bat`，会自动清理对应端口与项目的 `node.exe` / `esbuild.exe` / `powershell.exe` 后台进程。

### 方式二：命令行手动运行

#### 抖音本地沉浸版 (`douyin-local`)

```powershell
cd d:\WorkSpaceAi\webprogram\douyin-local

# 直接运行内置服务（提供前端构建产物与媒体 API，默认端口 3002）
npm run server

# 如需自定义媒体目录（示例）：
$env:DOUYIN_MEDIA_ROOT = "D:\Media\Douyin"
node server/index.mjs

# 前端开发调试 / 重新构建
npm run dev
npm run build
```

#### 特斯拉行车记录仪 (`tesla-dashcam`)

```powershell
cd d:\WorkSpaceAi\webprogram\tesla-dashcam

# 开发模式
npm run dev

# 构建并本地预览（默认端口 3000）
npm run build
npx vite preview --port 3000 --host 127.0.0.1
```
