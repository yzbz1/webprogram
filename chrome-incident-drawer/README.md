# chrome-incident-drawer

Chrome（Manifest V3）网页右侧悬浮事件单侧边栏扩展，交互与视觉风格 100% 复刻 DeepSeek Harness 插件（`dsh-plugin-incident-drawer`），并通过极简本机伴生服务与 DSH 插件**实时共享同一份配置文件与本地 Excel（`.xlsx`）**。

---

## 一、功能特性

- **与 DSH 插件实时双向共享**：共用 `$DSH_HOME/incident-drawer-config.json`（未设置 `DSH_HOME` 时为 `~/.dsh/incident-drawer-config.json`）。你在 DSH 或 Chrome 任意一端修改 Excel 路径、切换工作表或更新单据，另一端数秒内自动感知并提示刷新/防覆盖。
- **网页悬浮不挤占布局**：基于 **Shadow DOM** 样式隔离挂载在网页最右侧边缘，空白区域完全鼠标穿透（`pointer-events: none !important`），不污染原网页样式，也不影响划词、滚动与点击。
- **三态阶梯交互 + 自适应排版**：
  - 默认仅 `74px` 缩在右边缘；鼠标悬停单条向左展开完整单号；点击以手风琴卡片展开（带立体悬浮阴影，左边缘支持拖拽调宽 `280px–540px`）。
  - 直接读取 Excel 第 1 行表头作为字段名称（支持任意列数），输入框高度随文本内容与卡片宽度自动伸缩。
  - 第 1 列单号只读并自动识别超链接，顶栏点 **`打开`** 按钮直接在新标签页打开原工单。
  - 失焦自动无损写回 Excel，完整保留第 11 行起数据、超链接与其他日期工作表。
- **灵活的网站显示规则**：通过浏览器右上角扩展弹窗，可一键在当前站点隐藏/显示、切换“所有网页显示（排除列表）”或“仅限内网域名显示（支持 `*.company.internal`）”、切换跟随系统/浅色/深色外观。
- **本机安全隔离**：伴生服务仅监听 `127.0.0.1`（默认端口 `17892`），校验证书扩展 `chrome-extension://` 来源与自定义请求头，拒绝普通网页跨站直接调用。

---

## 二、安装方式

本方案由两部分组成：**本机伴生小服务**（负责读写硬盘 Excel） + **Chrome 扩展**（负责网页右侧 UI）。`bridge/` 与 `extension/` 已全部预打包，**运行时不需要 `node_modules`**。

### 第 1 步：启动本机 Excel 伴生服务

> 前提：电脑已安装 Node.js（或使用 DSH 自带的 Node）。

- **静默后台启动（推荐日常使用）**：双击项目根目录的 [start-bridge-silent.vbs](start-bridge-silent.vbs)（无黑框窗口）。
- **前台启动（查看端口/日志排查用）**：双击 [start-bridge.bat](start-bridge.bat)，默认监听 `http://127.0.0.1:17892`。
  - 若电脑未把 `node.exe` 加入系统环境变量 `PATH`，可通过参数或 `NODE_EXE` 指定 Node 路径（例如借用 DSH 内置 Node）：
    ```bat
    start-bridge.bat "<你的DSH安装目录>\resources\runtime\bin\node.exe"
    ```
- **停止服务**：双击 [stop-bridge.bat](stop-bridge.bat)。
- **设为开机自启（可选）**：按 `Win + R` 输入 `shell:startup` 回车打开启动文件夹，把 `start-bridge-silent.vbs` 的快捷方式放进去即可。

### 第 2 步：在 Chrome 中加载扩展

1. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
2. 打开页面右上角的 **「开发者模式」** 开关。
3. 点击左上角 **「加载已解压的扩展程序」**。
4. 选择本项目的 **`extension`** 文件夹（即包含 `manifest.json` 的目录）完成安装。
5. 建议点击 Chrome 右上角拼图图标，将 **「DSH 事件单悬浮侧边栏」** 固定（Pin）到工具栏，方便随时查看连接状态或切换当前网站显示。

### 公司内网离线迁移

1. 只需将整个 `chrome-incident-drawer` 文件夹（可以删掉或跳过 `node_modules`）拷贝到公司内网电脑任意目录。
2. 按上述第 1 步启动 `start-bridge-silent.vbs`（或 `start-bridge.bat`），再按第 2 步在 Chrome 加载 `extension` 文件夹即可离线使用。

---

## 三、使用方式

### 1. 网页右侧悬浮面板操作

加载扩展并刷新任意 HTTP/HTTPS 网页后，屏幕右侧边缘即出现事件单标签：
- **悬停预览**：鼠标移上某条标签，仅该条向左展开完整第 1 列单号。
- **点击编辑**：点击标签展开全部业务字段，左边缘可拖动调整宽度；修改后点别处或按 `Tab`（失焦）自动保存回 Excel，`Ctrl/Cmd + S` 可立即保存。
- **跳转原工单**：展开卡片后点击右上角 **`打开`** 按钮跳转第 1 列超链接。
- **切换 Excel / 工作表**：点击右上角工具栏 **齿轮 `⚙`**，可修改 `.xlsx` 路径、切换不同日期工作表或生成示例表（修改后同样同步给 DSH）。
- **临时收起**：点工具栏最右侧 **`»`** 缩成右边缘微小耳片，不遮挡网页。

### 2. 工具栏弹窗设置（网站显示范围 / 主题 / 端口）

点击 Chrome 工具栏上的插件图标，打开控制面板：
- **服务状态**：实时显示 `已连接`（及当前共享的 Excel 路径）或 `未连接`；点「刷新」可重新检测。
- **总开关 & 单站快捷开关**：可一键关闭悬浮面板，或快速对当前网页域名执行「在此站隐藏 / 加入白名单」。
- **显示范围模式**：
  - `所有网页显示（下方填写排除域名）`：默认模式，可排除不想展示的网站；
  - `仅在指定域名显示`：推荐仅在公司内网系统使用，例如填入：
    ```text
    itsm.company.internal
    *.oa.internal
    ```
- **主题外观 & 服务端口**：支持 `跟随系统 / 浅色 / 深色`；若本地端口 `17892` 被占用，启动伴生服务时可设环境变量 `BRIDGE_PORT=新端口`，并在此同步修改端口后点「保存设置」。

### 3. 常见问题排查

- **网页右侧显示「服务未启动」**：本机伴生服务未运行，双击 `start-bridge-silent.vbs` 启动后点面板上的「重连」即可。
- **修改路径后 DSH 和 Chrome 没同步**：确认两边运行在同一系统用户且 `DSH_HOME` 环境变量一致（两边均读写 `$DSH_HOME/incident-drawer-config.json` 或 `~/.dsh/incident-drawer-config.json`）。
- **提示冲突或文件被占用**：与 DSH 版一致——先关闭占用 `.xlsx` 的 Excel/WPS 软件再点「重试」；若硬盘文件已被另一端改写，选择「刷新 / 放弃并刷新」或「覆盖保存」。

---

## 四、目录结构与开发构建

```text
chrome-incident-drawer/
├── start-bridge.bat          # 前台启动本机 Excel 伴生服务（看日志）
├── start-bridge-silent.vbs   # 静默后台启动本机服务（无黑框）
├── stop-bridge.bat           # 停止后台服务
├── README.md
├── bridge/                   # 预打包的零依赖本机服务（server.mjs + excel-store.cjs）
├── extension/                # Chrome MV3 扩展目录（manifest.json + scripts + icons）
├── sample/incidents.xlsx     # 兜底示例 Excel
├── scripts/
│   ├── build.mjs             # esbuild 构建脚本与 PNG 图标生成
│   └── test-bridge.mjs       # 伴生服务安全校验与 Chrome<->DSH 共享 Excel E2E 测试
└── src/
    ├── shared/types.ts       # 前后端共享类型与配置定义
    ├── bridge/               # 本机服务：配置同步、Excel 读写、HTTP 桥接
    └── extension/            # Chrome 扩展：Background SW、Shadow DOM UI、Popup
```

本地二次开发与验证命令：

```bash
npm install
npm run typecheck
npm run build
npm test
```
