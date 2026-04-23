# CanvasSurface 组件超细讲解（新手 4 小时速通版）
目标：让你能在 4 小时内看懂并敢改 `src/components/CanvasSurface.tsx`。按“先认识 → 看事件 → 看渲染 → 练手修改”四步读。

---

## 1. 先认识都有哪些状态/变量
- 外部依赖：`nanoid`(生成 id)，`useWhiteboardStore`(全局状态)，`useShallow`(减少重渲染)。
- 类型：`Point {x,y}`，`Shape`（含 type、坐标、points、样式），`Tool`（select/pencil/rectangle/ellipse/line/text）。
- 本地 state：
  - `draft: { origin, shape } | null` —— 正在画的临时形状，抬起后才存进全局。
  - `pan: Point` —— 画布平移偏移，实现“无限画布”。
  - `panSession: { startClient, startPan } | null` —— 正在平移时记录鼠标起点和起始 pan。
- 从 store 读到：
  - 状态：`shapes`、`selectedIds`、`activeTool`、`stroke`、`fill`、`strokeWidth`、`opacity`
  - 动作：`addShape`、`selectShapes`
- 常量：`MIN_SHAPE_SIZE = 4`，过小的图形会被丢弃。

---

## 2. 核心小工具函数（看懂后主逻辑秒懂）
- `toCanvasPoint(event)`：把鼠标坐标减去 `pan`，得到画布坐标。平移后仍能正确命中/绘制。
- `hitTest(point)`：倒序遍历 shapes，用包围盒判断是否被点到，返回 shape id 或 undefined。
- `normalizeBox(a, b)`：给两个点，求出左上角 + 宽高（矩形/椭圆用）。
- `boundsFromPoints(points)`：给一串点，求外接矩形（自由笔、直线用）。
- `createBaseShape(tool, point, 样式)`：生成带 id/样式/时间戳的基础 shape，后面再补充尺寸或点。

---

## 3. 事件是怎么流转的
### PointerDown（按下）
1) 忽略非主指针：`if (!event.isPrimary) return`
2) 如果是“选择”工具：
   - 命中 shape → `selectShapes([id])`
   - 没命中 → 开始平移：记录 `panSession = {startClient: 鼠标位置, startPan: 当前 pan}`，并 `setPointerCapture`。
3) 如果是绘图工具：
   - `event.preventDefault()` 避免默认拖拽
   - 调 `startDraft` 创建草稿：
     - 文本：直接 `addShape` 一个占位文本（宽 120 高 32），不拖拽。
     - 直线：points=[start, start]，存到 draft。
     - 铅笔：points=[start]，存到 draft。
     - 矩形/椭圆：只存起点，尺寸待移动再算。

### PointerMove（移动）
- 如果在平移模式：根据鼠标位移 dx/dy 更新 `pan = startPan + dx/dy`，结束。
- 如果没有 draft：返回。
- 如果有 draft，根据工具更新：
  - 铅笔：points 追加当前点 → 用 `boundsFromPoints` 更新 x/y/w/h。
  - 直线：points=[origin, current] → 用 `boundsFromPoints` 更新包围盒。
  - 矩形/椭圆：用 `normalizeBox(origin, current)` 更新 x/y/w/h。

### PointerUp / PointerLeave（抬起或离开）
- 如果在平移：清空 `panSession`，结束。
- 如果在绘图：`finalizeDraft`
  - 过滤过小图形（非 free/line 且 w、h < 4）。
  - free/line 至少需要两个点。
  - 合格就 `addShape` 落盘，然后清空 draft。

---

## 4. 渲染怎么做的
- 外层：`<svg className="board-grid h-full w-full">`
- 平移：把所有形状包在 `<g transform="translate(pan.x pan.y)">` 里。pan 只影响显示，不改 shape 坐标。
- `renderShape(shape)` 按类型渲染：
  - rect：`<rect x y width height ...>`
  - ellipse：用中心+半径
  - line：用 points 的首尾做 x1/y1/x2/y2
  - free：把 points 拼成字符串给 `<polyline>`
  - text：简单 `<text>`，选中时加光晕
- 选中高亮：`selectedIds` 命中时加 drop-shadow。
- 草稿：如果有 draft，再画一遍 draft 形状（同一 transform 下）。

---

## 5. 立刻能动手的练习（改动小、容易验证）
- 调整最小尺寸：改 `MIN_SHAPE_SIZE` 看看误触是否减少。
- 改文本默认值/大小：在 `startDraft` 的文本分支改 `text`、`w`、`h`。
- 多选（简单版）：在选择工具下，按住 Shift 点击时，把新 id 合并进 `selectedIds`。
- 滚轮缩放（入门版思路）：
  - 增加 `scale` state。
  - `<g>` 上用 `transform="translate(...) scale(scale)"`。
  - `toCanvasPoint` 里坐标再除以 scale。
  - 滚轮事件里调整 scale（记得限制范围）。
- 自由笔抽稀（简单版思路）：在 pointer move 时对新增点做节流，或每次只保留隔点采样。

---

## 6. 常见坑（别踩）
- 不要把 pan 加到 shape 坐标上，pan 只放在 `<g transform>` 里；否则命中/撤销会乱。
- `points` 在撤销/重做用到的快照里必须深拷贝（store 已处理），否则历史会被污染。
- 只处理 `event.isPrimary`，防止多指/触控影响。
- 平移时用 pointer capture，保证拖出 SVG 边界也能收到 move/up。

---

## 7. 快速跳转代码位置（行号可能随改动略偏）
- 状态与取值：文件开头。
- 坐标与命中：`toCanvasPoint`、`hitTest`。
- 事件主流程：`startDraft`、`handlePointerDown/Move/Up`、`finalizeDraft`。
- 渲染：`renderShape` 与返回的 `<svg><g ...>`。

---

## 8. 进阶改造路线（看完基础再尝试）
- 多选/框选：画一个选框草稿，松手后选中框内的 shapes。
- 选框变换：为选中的形状画 8 个拉伸点 + 旋转手柄，拖动时改 w/h/rotation。
- 更精确命中：自由笔用“点到折线距离”而非包围盒；直线用阈值距离。
- 连线/锚点：line/connector 记录起止锚点，移动节点时自动更新。
- 性能：自由笔抽稀、节流 pointer move；按需渲染视口内的元素。

