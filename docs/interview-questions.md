# Realtime Whiteboard 项目面试题集 (模拟面试)

这份题集覆盖了从基础 React/TypeScript 到 SVG 图形学、状态管理、性能优化以及实时协作架构的全方位问题。

---

## 第一部分：基础与架构设计

### Q1. 为什么选择 SVG 而不是 Canvas (Context 2D) 来实现白板？
> **考察点**：技术选型能力、DOM vs Canvas 渲染差异。

**参考思路**：
- **开发效率**：SVG 是 DOM 元素，自带事件系统（onClick/Hover），无需像 Canvas 那样自己手写命中检测（Hit Test）和事件分发。
- **声明式编程**：配合 React 声明式渲染，状态 `shapes.map` 直接映射为 `<rect>`/`<path>`，代码可读性极高。
- **场景适用性**：白板通常图形数量在数千级别，DOM 性能足以支撑；如果是数万图元或高频像素操作（如滤镜/游戏），Canvas 才更合适。
- **样式能力**：CSS 可直接控制 SVG 样式（阴影、光标、动画），Tailwind 类名也容易接入。

### Q2. 项目的状态管理采用了 Zustand，为什么不用 Redux 或 React Context？
> **考察点**：状态管理库对比、性能优化意识。

**参考思路**：
- **Context 缺陷**：Context 通常会导致所有消费者在 Context Value 变化时重渲染，优化困难（需拆分 Context）。
- **Redux 繁琐**：Boilerplate 代码太多（Actions/Reducers/Types），Zustand 更轻量简洁。
- **Zustand 优势**：
  - **Selector + Shallow Diff**：通过 `useWhiteboardStore(useShallow(state => ({...})))` 精确控制重渲染，只有关注的字段变了才刷新组件，这对高频图形交互至关重要。
  - **脱离组件访问**：可以在 event handler 或 socket 回调中直接 `store.getState()`，无需 Hooks 环境。

### Q3. 项目使用了 `nanoid`，它和 `uuid` 有什么区别？为什么 ID 生成很重要？
> **考察点**：基础依赖认知。

**参考思路**：
- `nanoid` 更轻量（体积小），URL 友好，生成速度快。
- 在分布式协作中，必须确保 ID 全局唯一（Collision Resistant），否则两端同时创建图形会导致 ID 冲突覆盖。

---

## 第二部分：图形与交互 (核心难点)

### Q4. 无限画布的“平移 (Pan)”和“缩放 (Scale)”是如何实现的？坐标系如何转换？
> **考察点**：图形学基础、坐标变换矩阵理解。

**参考思路**：
- **渲染层**：只在最外层 `<g>` 上应用 `transform="translate(pan.x, pan.y) scale(scale)"`，保持 shape 自身坐标数据纯净（世界坐标）。
- **事件层 (核心)**：
  - 屏幕坐标 (Client) -> 画布世界坐标 (World)：
    $$World = (Client - Offset - Pan) / Scale$$
  - 这保证了无论怎么平移缩放，鼠标点击的位置都能准确映射到图形上。
- **以指针为中心缩放**：
  - 需要在缩放前后保持“指针下的世界坐标不变”，推导出 Pan 的补偿公式。

### Q5. 自由笔 (Pencil) 和直线的命中检测 (Hit Test) 是怎么做的？有什么改进空间？
> **考察点**：算法、碰撞检测。

**参考思路**：
- **现状**：目前用了简单的 AABB (Axis-Aligned Bounding Box) 包围盒检测。遍历所有点算出 minX/minY/maxX/maxY，点在矩形内即选中。
- **缺陷**：画一条对角线或“L”形，点击空白包围区域也会误判选中。
- **改进方案**：
  - **几何法**：点到线段的距离公式。遍历 Polyline 所有线段，若点到线段距离小于阈值（如 5px）则命中。
  - **Canvas Buffer**：离屏 Canvas 绘制线段（用特定颜色编码 ID），读取像素颜色判断命中（Pixel Perfect）。

### Q6. 文本编辑是如何实现的？为什么要用 DOM `<input>` 覆盖？
> **考察点**：SVG 缺陷处理、交互细节。

**参考思路**：
- SVG 的 `<text>` 标签不支持多行编辑、光标移动、选区等原生输入行为，自己实现代价极大。
- **方案**：双击时，在计算好的屏幕坐标位置覆盖一个透明背景的 HTML `<input>` 或 `<textarea>`。
- **同步**：输入结束（Blur/Enter）后，把值回写到 Store 的 SVG 数据，移除 Input。这是富交互图形应用的常用技巧（Foreign Object 也有兼容性坑）。

---

## 第三部分：实时协作 (高阶能力)

### Q7. 你的协作方案是如何解决“并发冲突”的？如果两人同时改同一个图形怎么办？
> **考察点**：分布式系统一致性、CRDT vs LWW。

**参考思路**：
- **现状 (LWW - Last Write Wins)**：目前基于全量快照或简单覆盖。A 和 B 同时改，后到达服务器的消息会覆盖前者。对于 demo 级项目可接受。
- **进阶 (CRDT)**：如果面试官追问改进，应回答引入 **Yjs** 或 **Automerge**。
  - 将 Shape 属性变成 CRDT Map，文本变成 Text 类型。
  - 即使离线编辑，重连后也能自动合并，不会丢失数据。

### Q8. 协作中的“撤销/重做 (Undo/Redo)”会有什么问题？如何解决？
> **考察点**：协作状态与本地历史的隔离。

**参考思路**：
- **问题**：如果远端推来了更新，直接写入本地历史栈，会导致我按“撤销”时，把别人的操作撤销了，体验极差。
- **解决**：
  - **隔离更新**：`applyRemoteShape` 只更新 `shapes` 数据，**不** `pushPast`（不入栈）。
  - **本地操作**：只有用户自己的交互（add/update/delete）才入栈。
  - **版本号**：引入 `version` 字段，只有本地 version 变化才触发全量广播，远端变化不回声。

### Q9. 实时光标 (Presence) 卡顿怎么优化？
> **考察点**：网络性能优化、节流。

**参考思路**：
- **问题**：`mousemove` 一秒触发 60-120 次，全量发送会导致网络风暴。
- **优化**：
  - **节流 (Throttle)**：限制发送频率（如 16ms 或 50ms 发一次）。
  - **插值 (Interpolation)**：接收端收到点 A 和点 B，中间动画补间，视觉上更流畅。
  - **数据精简**：只发 `{x, y, id}`，不发多余字段。

---

## 第四部分：性能优化

### Q10. 如果画了 5000 个图形，页面卡顿，你该如何优化？
> **考察点**：React 渲染优化、虚拟化。

**参考思路**：
- **渲染层面**：
  - **React.memo**：给 `renderShape` 里的图形组件加 memo，只有属性变了才重绘。
  - **虚拟渲染 (Culling)**：计算 Viewport (可视窗口)，只渲染在视口内的图形。SVG 自带视口裁剪但不减少 DOM 节点，需手动过滤 `shapes.map`。
- **逻辑层面**：
  - **抽稀**：自由笔的点太密，用 Douglas-Peucker 算法抽稀，减少 Polyline 节点数。
  - **分层**：静态背景层（不动的图）缓存为一张 Canvas/Image，只有动态层用 SVG。

### Q11. 如何防止协作广播过于频繁导致服务器压力？
> **考察点**：防抖策略。

**参考思路**：
- **防抖 (Debounce)**：在 `useEffect` 监听 shapes 变化时，设置 120ms 定时器。如果短时间内连续变化（如拖拽中），只在停下时发送一次 Snapshot。
- **增量更新**：不发全量 Snapshot，只发 Patch（变更的 shape ID 和 diff），极大减少带宽。

---

## 第五部分：代码与工程质量

### Q12. 如何测试画布的交互逻辑？
> **考察点**：测试策略。

**参考思路**：
- **单元测试**：针对纯逻辑函数（`hitTest`, `toCanvasPoint`, `pushPast`）写 Jest/Vitest 单测。
- **集成/E2E 测试**：用 Playwright/Cypress。
  - 模拟鼠标按下 -> 移动 -> 抬起，断言 DOM 中生成了对应的 `<rect>`。
  - 模拟多浏览器窗口，验证 Socket 消息互通。

### Q13. TypeScript 在项目中的最大价值体现在哪？
> **考察点**：TS 实践。

**参考思路**：
- **类型安全**：`Shape` 联合类型 (`'rect' | 'line' ...`) 配合 Tagged Union，在 `renderShape` 或 Reducer 中做 Exhaustive Check，防止漏处理某种图形。
- **重构信心**：修改 `Point` 结构或 `Store` 接口时，TS 瞬间报出所有受影响位置。















