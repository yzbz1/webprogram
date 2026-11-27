# dsh-plugin-incident-drawer

DeepSeek Harness（DSH）右侧悬浮事件单抽屉插件（Host + Client 双端复合插件，**零运行时外部依赖**），专为本地桌面端及公司内网离线部署设计，可与配套的 Chrome 扩展版（`chrome-incident-drawer`）实时共享同一份配置与本地 Excel。

---

## 一、功能特性

- **悬浮覆盖不挤占对话画布**：挂载在 DSH 原生 `shell.overlay` 悬浮层，外层完全鼠标穿透，不占用独立侧栏宽度；收起隐藏后仅在右边缘保留微小耳片。
- **三态阶梯交互**：
  - **默认收起态**：仅约 `74px` 窄标签贴在右边缘，最大限度减少对主画面的影响。
  - **鼠标悬停态（Hover）**：移到哪一条，仅那一条单独平滑向左展开显示完整第 1 列事件单号，其余单子仍缩在最右侧。
  - **点击编辑态（Click，手风琴模式）**：点击展开带有立体悬浮阴影的编辑卡片（切到另一条时自动收起前一条），左边缘支持手动拖拽调宽（`280px–540px` 自动记忆）。
- **动态读取 Excel 表头 & 自适应文本框**：
  - 第 1 行表头文字直接动态读取作为字段标签，不写死列名，支持任意列数（默认 6 列，更少或更多列均自动适配）。
  - 输入框高度随单元格文本内容及卡片宽度变化自动伸缩，多行内容完整展开显示。
- **第 1 列只读 + 超链接跳转**：
  - 自动解析 Excel 原生超链接、`=HYPERLINK(...)` 公式或纯 HTTP(S) 链接；第 1 列在界面和后端均强制只读，卡片顶栏提供独立的 **`打开`** 按钮跳转原工单，避免划选复制单号时误触。
- **失焦自动保存 & 外部变更防覆盖**：
  - 任意字段失焦（Blur）自动按串行队列写回 Excel（`Ctrl/Cmd + S` 可立即保存）。
  - 写回采用单元格级无损更新，完整保留第 11 行起的数据、第 1 列超链接、样式与其他日期工作表。
  - 每 4 秒及窗口聚焦自动校验文件指纹：当硬盘 Excel 被外部脚本、Excel 软件或 Chrome 扩展修改后，顶部立即提示刷新；若当前有未保存修改会暂停覆盖写盘，提供「放弃并刷新 / 覆盖保存」二选一。
- **按日期自动匹配工作表**：默认优先匹配当日 `YYYYMMDD`（如 `20261128`）工作表，兼容 `YYYY-MM-DD`、`YYYY.MM.DD` 等常见格式，也可在设置中随时切换历史日期工作表。

---

## 二、安装方式

因为本插件**零运行时外部依赖**（`dependencies` 为空，`exceljs` 已内嵌在 `lib/excel-store.cjs`），在断网的公司内网也可直接离线安装。

### 方式 1：在 DSH 界面直接安装（最简单，推荐公司内网使用）

1. 将离线包 `dist/dsh-plugin-incident-drawer-1.0.0.tgz` 拷贝到目标电脑（例如放到 `D:\dsh-plugins\dsh-plugin-incident-drawer-1.0.0.tgz`）。
2. 打开 DeepSeek Harness → 进入 **设置 → 插件** → 点击右上角 **`+ 添加插件`**。
3. 在输入框中直接粘贴 `.tgz` 文件的**本地绝对路径**（注意去掉两端可能带上的双引号 `""`）：
   ```text
   D:\dsh-plugins\dsh-plugin-incident-drawer-1.0.0.tgz
   ```
   > 也可以把 `.tgz` 解压成目录（保留 `package.json`、`cordis.patch.yml`、`lib/`、`sample/`），直接填入解压后的文件夹绝对路径。
4. 点击 **「安装」**，等待完成提示后重启/刷新插件即可生效。

### 方式 2：使用命令行或便携脚本安装

1. **先完全退出**正在运行的 DeepSeek Harness 桌面端。
2. 在命令行执行（桌面端使用 `--profile desktop`，Web 版使用 `--profile web`）：
   ```bat
   dsh plugin --profile desktop add "D:\dsh-plugins\dsh-plugin-incident-drawer-1.0.0.tgz"
   ```
   或直接运行本项目自带的便携脚本（自动定位插件目录并查找 `dsh.cmd`）：
   ```bat
   scripts\install-local.bat "<你的-dsh.cmd-路径>" desktop
   ```
3. 重新打开 DeepSeek Harness 即可在右侧边缘看到悬浮事件单标签。

### 升级 / 卸载

- **卸载**：在 DSH 插件管理页点击卸载，或退出桌面端后执行：
  ```bat
  dsh plugin --profile desktop remove dsh-plugin-incident-drawer
  ```
- **升级新版本**：先按上述方式卸载旧版本，再重新安装新版 `.tgz` 即可。

---

## 三、使用方式

### 1. 绑定你自己的 Excel 文件与日期工作表

1. 点击右侧面板顶部工具栏的 **齿轮图标 `⚙`** 打开设置弹窗。
2. 在 **「本地 Excel 文件路径 (.xlsx)」** 输入你自己的工作簿路径（例如 `D:\Work\incidents.xlsx`），点击 **「应用」**。
   - 若还没有现成表格，可点击 **「生成示例表」** 一键生成带当日与昨日工作表的示例 `.xlsx`。
3. 在 **「工作表」** 下拉框中可随时切换不同日期的 Sheet；默认自动优先匹配当日 `YYYYMMDD`（如 `20261128`）。

### 2. Excel 表格格式约定

- **第 1 行**：字段表头，插件直接读取第 1 行内容作为展开后的字段名（若某列表头为空则显示 `列 N`）。
- **第 2 行起**：数据行，默认加载**前 10 条非空行**（不做状态筛选）；第 11 行及之后的数据不会被加载，但在保存前 10 条时会被完整原样保留。
- **第 1 列**：事件单号（只读），支持 Excel 原生超链接、`=HYPERLINK("url", "文本")` 公式或纯 `http(s)://` 链接。
- **第 2 列起**：可编辑业务字段（支持短文本、日期与多行长文本）。

### 3. 日常交互与保存操作

- **查看单号**：鼠标悬停在右边缘某条缩略标签上，单条会向左伸出展示完整单号。
- **展开编辑**：点击标签打开编辑卡片（切到其他单子时自动收起上一条）；拖动卡片左边缘可手动调节宽度；点顶栏 **`打开`** 按钮可跳转该单据的超链接。
- **保存修改**：修改任意框后**点击别处 / 按 `Tab` 切到下一格（失焦）即自动保存**，也可按 `Ctrl + S`（macOS 为 `Cmd + S`）或点击顶部状态按钮立即保存。
- **贴边隐藏**：点击工具栏最右侧 **`»`** 按钮可把整组面板缩为右边缘微小耳片，再次点击即可还原。
- **与 Chrome 扩展共享**：路径配置统一保存在 `$DSH_HOME/incident-drawer-config.json`（未设置 `DSH_HOME` 时为 `~/.dsh/incident-drawer-config.json`）。配合 `chrome-incident-drawer` 使用时，两边实时读取同一份配置与同一个 Excel，任一端保存后另一端会自动亮起更新提醒。

### 4. 常见问题排查

- **提示「Excel 文件正被其他程序占用」**：Windows 下用 Excel/WPS 软件打开着同一份 `.xlsx` 会加文件锁，关闭表格软件后点击输入框下方「重试」或顶部「重试保存」即可。
- **提示「检测到 Excel 已更新 / 自动保存已暂停」**：说明硬盘上的文件已被你的 Skill、Excel 软件或 Chrome 端修改。未编辑时点「刷新」获取最新内容；有未保存修改时按需选择「放弃并刷新」或「覆盖保存」。

---

## 四、目录结构与开发构建

```text
dsh-plugin-incident-drawer/
├── package.json              # 插件清单与多版本引擎声明（dependencies 为空）
├── cordis.patch.yml          # Cordis 挂载补丁
├── README.md
├── sample/
│   └── incidents.xlsx        # 含当日与前一日工作表的示例 Excel（12 行数据）
├── scripts/
│   ├── build.mjs             # 打包脚本（产出 lib/index.js, lib/excel-store.cjs, lib/client.js）
│   ├── create-sample-excel.mjs
│   ├── test-host.mjs         # Host 读写/冲突/客户端加载自动化测试
│   ├── install-local.bat     # 便携安装脚本（写入本地 DSH profile）
│   └── pack-offline.bat      # 离线打包脚本（生成内网 .tgz 包）
└── src/
    ├── shared/types.ts       # 前后端共享接口契约
    ├── host/                 # Host 端：Excel 读写、配置持久化、/api/incident-drawer 路由
    └── client/               # Client 端：悬浮抽屉 React UI 与原生主题样式
```

本地开发与离线打包命令：

```bash
npm install
npm run typecheck
npm run build
npm run sample
npm test
scripts\pack-offline.bat
```
