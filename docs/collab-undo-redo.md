# 实时协作撤销/重做改造说明

## 背景
多人协作时使用单一历史栈会导致撤销/重做污染他人操作。目标：按用户隔离历史，撤销/重做仅影响各自绘制的图形，同时保持实时同步。

## 设计思路
- **按用户分桶历史**：`userHistories`（Record<userId, { past; future }>) 存每个用户的历史栈；当前用户由 `currentUserId` 指定。
- **图形归属标记**：为每个 Shape 写入 `createdBy`。历史快照与过滤都基于该字段，防止跨用户撤销。
- **推入历史的时机**：本地用户每次 add/update/remove/group/ungroup/toggleLock 前，将该用户当前的图形快照压入 past，并清空其 future。
- **撤销/重做规则**：
  - 撤销：仅取该用户 past 栈顶，回放到画布，但保留其他用户的图形（merge）。
  - 重做：仅取该用户 future 栈顶，同理合并其他用户图形。
  - `canUndo/canRedo` 基于当前用户的历史栈长度。
- **协作接入**：协作层在连接后调用 `setCurrentUser(userId)` 初始化用户历史；远端形状仍可直接应用（不会写入本地 past/future）。

## 关键新增代码

### 状态与工具方法
```ts
// src/state/useWhiteboardStore.ts
type UserHistory = { past: Shape[][]; future: Shape[][] }
currentUserId: string | null
userHistories: Record<string, UserHistory>
setCurrentUser: (id: string) => void

const getActiveUserId = (state) => state.currentUserId ?? 'local-user'
const filterUserShapes = (shapes, userId) => shapes.filter((s) => (s.createdBy ?? 'unknown-owner') === userId)
const pushUserPast = (state, userId) => { ... } // 仅存该用户的图形快照
const mergeUserSnapshot = (state, userId, userSnapshot) => { ... } // 保留他人图形
```

### 写操作入栈
```ts
// addShape / updateShape / removeShapes / groupShapes / ungroupShapes / toggleLock
const userId = getActiveUserId(state)
const history = pushUserPast(state, userId)
// 写入 createdBy，更新 userHistories[userId]
```

### 撤销/重做隔离
```ts
undo: () =>
  set((state) => {
    const userId = getActiveUserId(state)
    const history = getUserHistory(state, userId)
    if (!history.past.length) return state
    const previous = history.past.at(-1)!
    const currentUserShapes = filterUserShapes(state.shapes, userId)
    const nextFuture = trimHistory([cloneShapes(currentUserShapes), ...history.future])
    return {
      shapes: mergeUserSnapshot(state, userId, previous), // 保留他人图形
      userHistories: { ...state.userHistories, [userId]: { past: history.past.slice(0, -1), future: nextFuture } },
      version: state.version + 1,
    }
  }),
redo: () => { ... // 同理取 future 栈顶 }
canUndo/canRedo: 基于当前 userId 的 past/future 长度
```

### 协作层设置用户
```ts
// src/realtime/collaboration.tsx
useEffect(() => {
  setCurrentUser(userId)
}, [userId, setCurrentUser])
```

### 图形写入创建者
```ts
// src/components/CanvasSurface.tsx
const createBaseShape(..., createdBy: string): Shape => ({
  ...,
  createdBy,
})

startDraft(..., self.userId) // 使用协作提供的 userId
```

## 使用与验证
- 协作建立后自动设置当前用户；本地绘制的图形会带上 `createdBy`。
- 撤销/重做只作用于当前用户的图形；他人图形保持不变。
- 建议在两个浏览器会话中分别绘制、撤销、重做，确认互不干扰且实时同步。

## 影响范围
- 主要文件：`src/state/useWhiteboardStore.ts`，`src/components/CanvasSurface.tsx`，`src/realtime/collaboration.tsx`。
- 未更改 UI；按钮依旧复用原 undo/redo，可直接受益于隔离逻辑。







