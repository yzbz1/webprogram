# Tesla V15 Reality View & Dashcam Viewer

基于 React + TypeScript + Three.js 打造的 **Tesla FSD V15「Reality View（实景视图）」** 仿真车机与**特斯拉行车记录仪查看器** Web 应用。主界面采用实时 3D PBR 写实城市环境渲染并支持即插即用游戏手柄驾驶，点击底部 Dock 或快捷卡片即可无缝呼出行车记录仪多路播放器。

## 核心特性

### 1. Tesla FSD V15 写实 3D 实景主屏 (`RealityViewDesktop`)
- **实时 3D 城市渲染引擎**（[RealityWorldEngine.ts](src/components/reality/RealityWorldEngine.ts)）：
  - 5×5 正交城市街区、湿滑反射路面（含粗糙度水洼、轮胎印、双黄线与斑马线）、带发光橱窗与霓虹灯牌的多层城市建筑、行道树、路灯、实时红绿灯以及行驶的 AI 车流与行人。
  - 基于 Three.js `MeshPhysicalMaterial` 清漆车漆 + `PMREMGenerator` 动态环境反射 + `UnrealBloomPass` 泛光，打造尾灯/刹车灯地面红光反射、矩阵大灯地面光锥以及雨夜霓虹质感。
- **V15 标志性 HUD 与 AR 视觉**：
  - 发光蓝色 FSD 规划轨迹光带（Planned Path Ribbon）+ 悬浮在转弯路口上方的半透明 3D 青蓝色 AR 导航箭头（`> > >`）+ 车位白色 `V` 型标识。
  - 左上角极细字体车速表、能量回收/加速条、`Self-Driving` 接管按钮（`Standard / Hurry / Mad Max`）、限速牌与行内 Turn-by-Turn 路口提示。
  - **Tap-to-Navigate**：直接在 3D 路面上点击任意位置即可投放目的地蓝标，FSD 自动规划并转向前往。
  - 支持切换 **3 种天气光照**（夜雨霓虹 / 落日余晖 / 晴朗白昼）、**4 种视角**（V15 实景视角 / 电影低角 / 上帝俯视 / 前舱第一人称）、**5 款特斯拉原厂车漆**，以及 **World / Map / Calm 宁静模式**。

### 2. 即插即用游戏手柄 & 键鼠驾驶 ([gamepadController.ts](src/utils/gamepadController.ts))
| 操作 | Xbox / DualSense 手柄 | 键盘 / 鼠标 |
| :--- | :--- | :--- |
| 油门 / 刹车与倒车 | `RT` / `LT` 线性扳机 | `W` / `S` 或 `↑` / `↓` |
| 转向 | 左摇杆 | `A` / `D` 或 `←` / `→` |
| 360° 环视 / 缩放 | 右摇杆 | 鼠标左键拖拽 / 滚轮 |
| 开关 FSD 自动驾驶 | `A` 键 | `F` |
| 手刹 / 驻车挡 (`P`) | `B` 键 | `Space` / `P` |
| 打开/关闭行车记录仪 | `X` 键 | 点击 Dock 或卡片按钮 |
| 切换视角 / 天气 / 车漆 | `Y` / 十字键上下 / 十字键左右 | `V` / `T` / `C` |
| 左/右转向灯 | `LB` / `RB` | `Q` / `E` |

### 3. 特斯拉行车记录仪查看器 ([DashcamApp.tsx](src/components/dashcam/DashcamApp.tsx))
- 支持直接选择或拖入特斯拉 U 盘 `TeslaCam` 目录（自动解析 `SentryClips` / `SavedClips` / `RecentClips` 与 `event.json` 红点定位），也内置 4 组四路同步演示场景。
- 支持单主视角 + 右侧四路实时缩略图切换、`2×2` 四路同屏、逐帧步进、画面放大平移、夜间车牌滤镜增强及高清 PNG 水印截图导出。

## 目录结构

```text
tesla-dashcam/
├── src/
│   ├── components/
│   │   ├── car-os/          # 顶部状态栏、底部 Dock、车辆设置弹窗
│   │   ├── dashcam/         # 行车记录仪查看器、四路播放与演示引擎
│   │   └── reality/         # V15 3D 实景引擎、PBR 纹理与车型网格
│   ├── utils/               # 手柄/键盘控制器、TeslaCam 解析器、截图工具
│   └── types/               # TypeScript 类型定义
├── 启动-特斯拉行车记录仪.bat   # 一键启动预览服务 (端口 3000)
├── 停止-特斯拉行车记录仪.bat   # 一键停止端口 3000 后台服务
└── README.md
```

## 快速开始

- **双击一键脚本**：直接双击本目录下的 `启动-特斯拉行车记录仪.bat` 即可打开 `http://127.0.0.1:3000/`。
- **命令行启动**：
  ```powershell
  npm install
  npm run build
  npx vite preview --port 3000 --host 127.0.0.1
  ```
