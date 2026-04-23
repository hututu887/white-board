# 扩展方案：协作可靠性 / 历史回放 / 权限身份

本文记录已落地的三个扩展能力：协作可靠性增强、时间轴快照与回放、角色权限管控，并给出核心新增代码与思路。

## 协作可靠性
目标：在多人实时同步时避免旧快照覆盖新状态。
- 新增 `lastRemoteSnapshotAt`：记录最后一次接受的远端快照时间。
- `replaceShapes(shapes, updatedAt)`：如果 `updatedAt` 早于已处理时间则跳过，防止旧消息回滚。
- 协作层接收快照时传入 `updatedAt`。

代码要点：
```ts
// src/state/useWhiteboardStore.ts
lastRemoteSnapshotAt: 0,
replaceShapes: (shapes, updatedAt) =>
  set((state) => {
    if (updatedAt && updatedAt <= state.lastRemoteSnapshotAt) return state
    return { shapes: cloneShapes(shapes), lastRemoteSnapshotAt: updatedAt ?? state.lastRemoteSnapshotAt }
  })

// src/realtime/collaboration.tsx
client.onSnapshot((snapshot) => {
  skipNextBroadcast.current = true
  replaceShapes(snapshot.shapes, snapshot.updatedAt)
})
```

## 历史与回放（时间轴快照）
目标：在撤销/重做之外，支持命名快照与一键回放。
- 新增 `timeline: TimelineEntry[]`，最多保留 20 条。
- `addCheckpoint(name?)`：克隆当前画布存为快照。
- `restoreCheckpoint(id)`：切换到指定快照并递增版本。
- 只在可编辑角色下生效，避免访客修改。

代码要点：
```ts
// src/state/useWhiteboardStore.ts
type TimelineEntry = { id: string; name: string; at: number; shapes: Shape[] }
addCheckpoint: (name) =>
  set((state) => {
    if (isReadOnly(state)) return state
    const entry = { id: nanoid(), name: name?.trim() || `快照-${new Date().toLocaleTimeString()}`, at: Date.now(), shapes: cloneShapes(state.shapes) }
    return { timeline: [...state.timeline, entry].slice(-20) }
  })
restoreCheckpoint: (id) =>
  set((state) => {
    if (isReadOnly(state)) return state
    const target = state.timeline.find((item) => item.id === id)
    if (!target) return state
    return { shapes: cloneShapes(target.shapes), version: state.version + 1 }
  })
```

## 权限与身份
目标：支持只读角色，阻止非编辑者修改画布。
- 新增 `role: 'owner' | 'member' | 'viewer'` 与 `setRole`。
- 编辑类操作（新增/更新/删除/组/解组/锁定、撤销重做、快照）在 `role === 'viewer'` 时直接返回原状态。
- 保持选择/查看操作可用。

代码要点：
```ts
// src/types/shape.ts
export type Role = 'owner' | 'member' | 'viewer'

// src/state/useWhiteboardStore.ts
role: 'owner',
setRole: (role) => set({ role }),
const isReadOnly = (state) => state.role === 'viewer'
// 在 addShape/updateShape/removeShapes/groupShapes/ungroupShapes/toggleLock/undo/redo/addCheckpoint/restoreCheckpoint 前判断 isReadOnly
```

## 受影响文件
- `src/state/useWhiteboardStore.ts`：角色、时间轴、快照防回滚。
- `src/realtime/collaboration.tsx`：快照 updatedAt 透传。
- `src/types/shape.ts`：新增 Role。

## 使用建议
- 将协作用户 ID 通过 `setCurrentUser` 已自动接入；可在 UI 增加角色切换或快照按钮。
- 在弱网/延迟环境验证：旧快照不会覆盖本地；Viewer 身份无法修改；快照可保存/恢复场景状态。







