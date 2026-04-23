# 全项目逐行讲解（函数级详细解释，源码不改动）

> 本文按文件逐函数解释“它做什么 / 怎么做 / 为什么这样做”。对照源码阅读即可，相当于给每段代码加了文字注释。未修改源文件。

---

## src/types/shape.ts
- `Tool`：枚举工具，决定交互与渲染分支（select/pencil/rectangle/ellipse/line/text）。
- `Role`：权限角色（owner/member 可写，viewer 只读）。
- `Point`：基础坐标结构。
- `Shape`：图形定义。核心字段：
  - `type` 决定渲染（free/rect/ellipse/line/text）。
  - `points` 给 free/line 记录路径。
  - `x,y,w,h` 记录包围盒，便于选中/渲染。
  - 样式：`stroke/fill/strokeWidth/opacity`。
  - `text` 文本内容；`groupId` 分组；`locked` 锁定；`createdBy` 归属；`createdAt/updatedAt` 时间戳。
- `Presence`：协作在线状态，含光标位置与活跃时间。
- `BoardSnapshot`：全量 shapes 快照 + 更新时间戳，用于同步。

---

## src/state/useWhiteboardStore.ts（Zustand 全局状态）
### 工具函数
- `cloneShape`：深拷贝单个图形（points 也拷贝），避免共享引用污染历史。
- `cloneShapes`：数组级深拷贝。
- `getOwnerId`：取 `createdBy`，无则标记 `'unknown-owner'`。
- `filterUserShapes(shapes, userId)`：过滤出特定用户的图形，用于分桶历史。
- `trimHistory(items)`：限制历史长度 30，防内存无限增长。
- `getUserHistory(state, userId)`：取某用户 past/future，没有则返回空栈。
- `pushUserPast(state, userId)`：在写操作前调用，把“该用户的当前图形快照”压入 past，并清空 future（按业务约定）。
- `mergeUserSnapshot(state, userId, userSnapshot)`：撤销/重做时，把“其他用户图形”与“该用户快照”合并，保证多人互不覆盖。
- `getActiveUserId(state)`：当前 userId，若空用 `'local-user'`（单机兜底）。
- `isReadOnly(state)`：role 为 viewer 时只读，写操作早退。

### 状态字段
- 核心：`shapes`、`selectedIds`、`activeTool`、`stroke/fill/strokeWidth/opacity`、`version`。
- 权限：`role`。
- 历史：`userHistories`（分用户 past/future）、`currentUserId`。
- 时间轴：`timeline`（命名快照，最多 20 条）。
- 协作防回滚：`lastRemoteSnapshotAt`（记录最新远端快照时间）。

### 方法详解
- `setCurrentUser(userId)`：设置当前用户；若无历史桶则初始化空 past/future。
- `setRole(role)`：切换角色；viewer 时所有写操作会被拦截。
- 写操作（`addShape/updateShape/removeShapes/groupShapes/ungroupShapes/toggleLock`）流程一致：
  1) 若 `isReadOnly` 返回原状态。
  2) 取当前 userId。
  3) `pushUserPast` 保存该用户当前图形快照，future 清空。
  4) 执行具体写逻辑（新增/更新/过滤/分组/锁定）。
  5) 更新 `userHistories[userId]` 与 `version++`。
  6) `addShape` 额外：若图形缺 `createdBy`，补写当前 userId。
- `replaceShapes(shapes, updatedAt)`：
  - 如果带时间戳且早于 `lastRemoteSnapshotAt`，直接忽略（防旧快照覆盖新状态）。
  - 否则深拷贝替换全量 shapes，并更新 `lastRemoteSnapshotAt`。
- `applyRemoteShape(shape)`：
  - 单条远端更新（不过历史）。存在则替换，不存在则追加。
- 时间轴：
  - `addCheckpoint(name?)`：可写时才允许；克隆当前 shapes 入 timeline，命名（缺省用时间），最多保留 20。
  - `restoreCheckpoint(id)`：可写时才允许；找到快照后克隆覆盖 shapes，version++。
- 撤销 `undo`：
  1) 若只读或无 past 返回原状态。
  2) 拿当前 userId 的 `history`。
  3) 取 past 栈顶 `previous`；当前用户图形 `currentUserShapes` 进入 future 栈（深拷贝）；past 出栈。
  4) `mergeUserSnapshot`：用 previous 替换该用户图形，其他用户保持。
  5) 写回 userHistories，并 `version++`。
- 重做 `redo`：
  1) 若只读或无 future 返回原状态。
  2) 取 future 头部 `next`，其余入 rest。
  3) 当前用户图形入 past（深拷贝，trim 长度）。
  4) `mergeUserSnapshot` 用 `next` 替换该用户图形。
  5) 写回 userHistories，并 `version++`。
- `canUndo/canRedo`：读取当前 userId 的 past/future 长度判断。

> 设计要点：多用户历史分桶 + 归属合并，避免撤销污染他人；只读早退，防止 viewer 修改；旧快照保护，防延迟回滚。

---

## src/realtime/socket.ts
- `createRealtimeClient(roomId, userId)`：生成 socket 客户端。
  - 连接配置：`WS_URL`（env 或默认 3001），禁用自动连接，强制 websocket，query 携带 room/userId。
  - 方法：
    - `connect/disconnect`：手动连接控制。
    - `emitShape(shape)`：发送单个形状更新。
    - `emitSnapshot(snapshot)`：发送全量板状态。
    - `emitPresence(cursor)`：发送光标。
    - `onShape/onSnapshot/onPresence`：注册监听并返回 off 函数。

---

## src/realtime/collaboration.tsx
- 提供 Context：`status/roomId/self/peers/sendPresence/error`。
- 本地身份：`userId`（nanoid）、`color`（哈希取色）、`self` presence 状态。
- 状态引用：`shapes/version`（触发广播），`replaceShapes/applyRemoteShape/setCurrentUser`（写 store）。
- refs：
  - `clientRef` socket 客户端。
  - `skipNextBroadcast` 标记：收到远端更新后本地不再广播同一改动。
  - `presenceThrottle`：16ms 节流。
  - `snapshotTimer`：120ms 延时广播快照。
- 连接 useEffect：
  - 创建 client，`setStatus('connecting')`，`connect()`。
  - 监听 connect/disconnect/error 更新 status/error。
  - `onShape`：标记 skip，`applyRemoteShape`。
  - `onSnapshot`：标记 skip，`replaceShapes`（防回滚逻辑在 store 内）。
  - `onPresence`：更新 peers（带 lastActive）；跳过自己。
  - 卸载：off 监听、disconnect。
- 广播 useEffect（依赖 shapes/version/status）：
  - 若未连接或 skipNextBroadcast 为 true，则清标记/不发。
  - 否则 120ms 后 `emitSnapshot({ shapes, updatedAt: Date.now() })`，可取消定时器。
- peers 清理 useEffect：
  - 每 4s 清掉 12s 未活跃的 peer。
- `sendPresence(cursor?)`：
  - 16ms 节流，更新 self.lastActive，并 `emitPresence(cursor)`。

---

## src/components/CanvasSurface.tsx
### 局部状态
- `draft` 草稿（origin+shape），绘制进行中。
- `pan/scale` 视图变换；`panSession` 记录平移起点。
- `editing` 文本编辑状态；`inputRef` 绑定输入框。
- `svgRef` 用于取边界和 pointer 坐标。

### 工具函数
- `normalizeBox(a,b)`：矩形包围盒（取 min/abs）。
- `boundsFromPoints(points)`：路径包围盒（min/max）。
- `createBaseShape(tool, point, stroke, fill, strokeWidth, opacity, createdBy)`：
  - 生成基础 Shape：id/type/x/y/w/h=0/rotation/stroke/fill/strokeWidth/opacity/locked=false/createdBy/timestamps。
  - type 规则：pencil->free，rectangle->rect，其余跟 tool。
- `clamp(value,min,max)`：限制缩放。
- `toCanvasPoint(event)`：屏幕坐标→画布坐标（减去 svg left/top 与 pan，再除以 scale）。
- `toScreenPoint(point)`：画布→屏幕（乘 scale，加 pan）。
- `hitTest(point)`：从 shapes 尾部向前，按 bbox 命中，返回 id。

### 交互主逻辑
- `startDraft(tool, start, createdBy)`：
  - 创建 base shape。若 tool=text 直接 addShape 文本（默认宽高、文本“文本”）。
  - line/free 初始化 points；其余作为草稿存入 draft。
- `handlePointerDown`：
  - 仅处理主指针；取画布点，发送光标。
  - select 模式：hitTest 命中则选中（支持 shift 多选），未命中则进入平移 session（记录客户端坐标和 pan 起点并捕获指针）。
  - 绘制模式：阻止默认，调用 startDraft（带 self.userId）。
- `handlePointerMove`：
  - 发送光标。若平移会话，计算 dx/dy 更新 pan。
  - 若有 draft：更新当前点，复制 shape 更新 updatedAt：
    - free：points 追加，重算包围盒。
    - line：points 两点，重算包围盒。
    - 其他：normalizeBox 算 w/h/x/y。
- `finalizeDraft`：
  - 没草稿直接返回。
  - 过滤过小图形（非 free/line 且 w/h < MIN_SHAPE_SIZE）或自由线条点不足。
  - 合格则 `addShape`（深拷贝在 store 里处理）。
  - 清空 draft。
- `handlePointerUp/Leave`：
  - sendPresence(undefined) 取消光标。
  - 若在平移会话则结束；否则 finalizeDraft。
- `handleWheel`：
  - 阻止默认；以鼠标位置为中心缩放，更新 pan 使视觉锚点不跳。
- `handleDoubleClick`：
  - select 模式命中文本：进入编辑，定位输入框到屏幕坐标，带缩放尺寸。
- 文本编辑交互：
  - useEffect 聚焦输入框。
  - `commitEditing(newValue)`：空值直接关闭；否则 `updateShape` 写 text + updatedAt。
  - input onBlur/onEnter 调用 commit；Esc 取消。

### 渲染
- SVG 包裹 `<g transform="translate pan scale">`。
- `renderShape`：
  - 公共样式 stroke/strokeWidth/opacity/选中高亮类名。
  - rect/ellipse/line/polyline/text 分支渲染；line/free 用 points；text 带描边字形突出。
- 主体：
  - 绘制所有 shapes。
  - 若有 draft，单独渲染草稿。
  - peers 光标：小圆点 + 名字标签，按 peer.cursor 位置。
  - 底部显示缩放百分比。

---

## src/components/TopBar.tsx
- 从 store 取 undo/redo、canUndo/canRedo（布尔）、activeTool。
- 按钮：
  - “撤销” onClick=undo，disabled 绑定 `!canUndo`。
  - “重做” onClick=redo，disabled 绑定 `!canRedo`。
  - 导出 PNG：调用 `exportSvgToPng('whiteboard-svg', 'whiteboard.png')`，带 loading 状态。
- 显示当前工具标签。

---

## src/components/Toolbar.tsx
- 工具列表 `tools`：id/label/快捷键。
- 按钮切换 activeTool，高亮当前。
- 样式控制：
  - 描边/填充颜色 `<input type="color">`。
  - 粗细 `<input type="range" min=1 max=12>`。
  - 透明度 `<input type="range" min=0.2 max=1 step=0.05>`。

---

## src/components/LayerList.tsx
- 从 store 取 shapes/selectedIds 及 group/ungroup/toggleLock/selectShapes。
- 计算 hasSelection / anyLocked。
- 顶部按钮：组合/解散/锁定/解锁（禁用条件基于选中/锁状态）。
- 列表：
  - 逆序展示（后绘制在上）。
  - 点击：单选或 shift 多选（增删 id）。
  - 标签显示类型、锁、组标记，右侧显示截取的 id。

---

## docs 目录
- `learning-guide.md`：入门与关键点提示。
- `collab-undo-redo.md`：多用户撤销隔离方案。
- `extensions.md`：协作可靠性/历史回放/权限身份扩展。
- `permissions-test-guide.md`：权限与只读测试脚本。
- `full-code-walkthrough.md`（本文）：函数级讲解。

---

## 运行与验证速记
1) `node server.js`（协作服务）
2) `npm run dev` → http://localhost:5173
3) 双窗口验证：绘制/撤销隔离，viewer 只读拦截，旧快照不回滚。
4) 导出、文本、平移缩放、锁定/组合、快照/权限按需体验。

