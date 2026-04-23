# Realtime Whiteboard 项目学习指南

## 1. 项目概览
本项目是一个基于 React 19 + TypeScript + Zustand 的实时协作白板。它涵盖了图形绘制、状态管理、无限画布、SVG 渲染以及基于 Socket.IO 的实时协作。

核心技术栈：
- **前端**：React 19, TypeScript, Vite, Tailwind CSS
- **状态管理**：Zustand (含 `useShallow` 优化)
- **图形渲染**：SVG (声明式渲染)
- **实时协作**：Socket.IO Client + Node.js 最小服务端

---

## 2. 学习路径建议 (由浅入深)

建议按以下顺序阅读和调试代码：

### 第一阶段：基础渲染与状态 (1-2 小时)
目标：理解图形是如何画出来的，状态是如何管理的。

1. **类型定义** (`src/types/shape.ts`)
   - 看 `Shape` 结构：坐标(x,y)、宽高(w,h)、样式、锁定(locked)、分组(groupId)。
   - 看 `Tool` 类型：理解工具有哪些 (select, pencil, rect 等)。

2. **状态仓库** (`src/state/useWhiteboardStore.ts`)
   - 重点看 `shapes` 数组如何存储所有图形。
   - 看 `addShape/updateShape`：如何通过 spread 操作符更新不可变数据。
   - 看 `undo/redo`：利用 `past/future` 栈实现的时间旅行（注意 `cloneShapes` 深拷贝）。
   - 看 `version`：用于协作防抖的版本号机制。

3. **画布组件** (`src/components/CanvasSurface.tsx`)
   - **渲染**：看 `renderShape` 如何把 Shape 数据转为 `<rect>`, `<line>`, `<polyline>` 等 SVG 元素。
   - **坐标系**：理解 `pan` (平移) 和 `scale` (缩放)。
     - 渲染层：`<g transform="translate(...) scale(...)">`
     - 事件层：`toCanvasPoint` 如何把鼠标屏幕坐标换算回世界坐标 (减去 pan，除以 scale)。
   - **交互流**：
     - `handlePointerDown` -> `startDraft` (创建草稿)
     - `handlePointerMove` -> 更新 `draft`
     - `handlePointerUp` -> `finalizeDraft` (存入 store)

### 第二阶段：交互增强 (1-1.5 小时)
目标：理解复杂交互逻辑。

1. **无限画布与缩放**
   - 再次细看 `handleWheel`：如何以鼠标为中心进行缩放 (计算 worldX/Y -> 调整 pan)。
   - 看 `handlePointerDown` 中的平移逻辑 (中键或未命中时的拖拽)。

2. **选择与编辑**
   - `hitTest`：简单的矩形包围盒碰撞检测。
   - 多选逻辑：Shift 键切换选中状态。
   - 文本编辑：`handleDoubleClick` 如何定位 `<input>` 覆盖在 SVG 上。

3. **图层管理** (`src/components/LayerList.tsx`)
   - 组合/锁定逻辑：如何调用 store 的 `groupShapes/toggleLock` 批量更新状态。

### 第三阶段：实时协作 (1.5 小时)
目标：理解多人如何同屏协作。

1. **服务端** (`server.js`)
   - 极简的 Socket.IO 服务：负责广播 `shape:update`, `board:snapshot`, `presence`。

2. **协作连接** (`src/realtime/collaboration.tsx`)
   - `useProvideCollaboration` Hook：管理 socket 连接、房间状态。
   - **快照同步**：本地 `shapes` 变动 -> 防抖 (120ms) -> `emitSnapshot`。
   - **远端更新**：收到快照 -> `replaceShapes` 或 `applyRemoteShape` (不写历史，防止污染 undo)。
   - **光标同步**：`sendPresence` (节流) -> 广播位置 -> 对方 `peers` 列表渲染。

---

## 3. 关键文件索引

| 文件路径 | 作用 | 重点关注 |
| :--- | :--- | :--- |
| `src/types/shape.ts` | 类型定义 | Shape 结构 |
| `src/state/useWhiteboardStore.ts` | 全局状态 | undo/redo, clone, version |
| `src/components/CanvasSurface.tsx` | 画布核心 | toCanvasPoint, renderShape, handleWheel |
| `src/realtime/collaboration.tsx` | 协作逻辑 | Socket 连接, 防抖广播, Presence |
| `src/realtime/socket.ts` | Socket 封装 | 事件定义 |
| `server.js` | 后端服务 | 广播逻辑 |

---

## 4. 调试小任务 (动手练)

为了检验学习成果，尝试做以下小修改：

1. **修改颜色**：在 `Toolbar.tsx` 加一个紫色，并在画布上画出紫色矩形。
2. **调整缩放**：修改 `MIN_SCALE` / `MAX_SCALE` 范围，体验变化。
3. **改选中样式**：在 `renderShape` 里把选中时的阴影颜色改成红色。
4. **自制工具**：尝试加一个 "Circle" 工具 (类似 Ellipse 但强制宽高相等)。

## 5. 常见问题 (FAQ)

- **为什么不用 Canvas API 而用 SVG？**
  - SVG 是 DOM 节点，事件处理 (onClick/hover) 原生支持，开发简单，适合图形数量中等 (<5000) 的场景。
- **撤销重做为什么很占内存？**
  - 目前采用了全量快照深拷贝。优化方向是改用 Patch (Immer) 或命令模式。
- **为什么协作时有时候会回弹？**
  - 简单的快照覆盖策略 (Last Write Wins) 在高并发下会有冲突。进阶方案是 CRDT (Yjs)。
















