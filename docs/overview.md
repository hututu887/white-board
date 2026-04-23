# 实时白板项目生成思路概览

## 生成目标
- 用 React + TypeScript + Vite 搭建一个可扩展的实时白板框架，仿 Excalidraw 的交互。
- 支持基础绘制（矩形/椭圆/直线/铅笔/文本）、选择与无限画布平移、撤销重做。
- 预留实时协作接口，方便后续接入 Socket/CRDT。
- 使用 Tailwind CSS 替换样式，快速迭代 UI。

## 生成流程（按时间顺序）
1. **初始化模板**：使用 Vite React TS 默认模板（保留 `vite.config.ts`、`tsconfig.*`、`src/main.tsx`）。
2. **安装核心依赖**：`react`、`react-dom`（模板自带），新增 `zustand`（状态）、`socket.io-client`（实时预留）、`nanoid`（ID）。
3. **定义类型**：`src/types/shape.ts` 定义 `Tool`、`Shape`、`Point`、`Presence`、`BoardSnapshot`。
4. **状态管理**：`src/state/useWhiteboardStore.ts`
   - 存储：`shapes`、`selectedIds`、`activeTool`、样式（stroke/fill/strokeWidth/opacity）、历史栈 `past/future`。
   - 方法：增/改/删形状、选择/清空、样式设置、撤销/重做（限制 30 步，深拷贝保障安全）。
5. **画布实现**：`src/components/CanvasSurface.tsx`
   - 用 SVG 渲染；`nanoid` 生成形状 ID。
   - 工具：select/pencil/rectangle/ellipse/line/text。自由笔累加点并重算包围盒；矩形等用起点-终点归一化；文本直接落点占位。
   - 命中检测：简单包围盒逆序遍历。
   - 撤销重做调用 store。
   - **无限画布**：`pan` 状态 + `<g transform="translate(x y)">`；选择模式点击空白开始平移，命中元素则选中。
6. **UI 组件**：
   - `TopBar.tsx`：品牌、当前工具、撤销/重做按钮。
   - `Toolbar.tsx`：工具按钮 + 样式调节（颜色/粗细/透明度）。
   - `LayerList.tsx`：倒序显示图层，点击选中。
   - `PresencePanel.tsx`：协作占位（示例在线用户）。
   - `App.tsx` 组合布局（左工具栏/中画布/右侧面板/顶部栏）。
7. **实时预留**：`src/realtime/socket.ts` 封装 Socket.IO 客户端（connect/disconnect，shape/presence 事件，快照）。
8. **样式迁移到 Tailwind**：
   - 安装 `tailwindcss@3`、`postcss`、`autoprefixer`。
   - `tailwind.config.js` 设置 `content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']`。
   - `src/index.css` 仅保留 `@tailwind base/components/utilities` 与少量全局色/网格背景。
   - 组件 JSX 改用 Tailwind 类（暗色、圆角、阴影、布局网格等）。
9. **验证**：多次 `npm run build`，修正 React 19 + Zustand 选择器的浅比较（使用 `useShallow`）与 Tailwind content 警告，确保无类型/构建错误。

## 关键技术点
- **状态**：Zustand + selector + `useShallow` 降低重渲染；undo/redo 通过快照栈，限制长度避免内存膨胀。
- **绘制与几何**：自由笔累点 + 包围盒计算；直线/矩形/椭圆基于起点-终点；文本占位落点。
- **无限画布**：平移存状态，不改形状坐标；指针坐标转换扣除 pan 偏移。
- **ID**：`nanoid` 生成形状唯一标识。
- **实时预留**：`socket.io-client` 封装，未在 UI 中启用，待接入服务器广播。
- **样式**：Tailwind 组件化类名；自定义网格背景 `board-grid` 保留在 `index.css`。

## 目录速览
- `src/App.tsx`：页面布局。
- `src/main.tsx`：入口。
- `src/index.css`：Tailwind 指令 + 全局基础色/网格。
- `src/state/useWhiteboardStore.ts`：白板状态/历史。
- `src/types/shape.ts`：类型模型。
- `src/components/CanvasSurface.tsx`：画布交互与渲染。
- `src/components/Toolbar.tsx` / `TopBar.tsx` / `LayerList.tsx` / `PresencePanel.tsx`：UI。
- `src/realtime/socket.ts`：Socket 封装。
- `tailwind.config.js`、`postcss.config.js`：样式配置。

## 运行与开发
```bash
npm install
npm run dev   # http://localhost:5173
npm run build
```

## 后续可扩展方向
- 交互：选框变换/旋转、吸附对齐线、组合/锁定、连线锚点。
- 协作：接入 Socket.IO 或 yjs（CRDT），光标展示、快照/操作日志。
- 资源：导出 PNG/SVG、图片贴图、模板库。
- 性能：自由笔抽稀、rAF 批绘制、多层/离屏 Canvas。
- 体验：快捷键、缩略图、触控/双指缩放。

