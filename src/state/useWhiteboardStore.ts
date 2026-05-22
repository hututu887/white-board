import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Role, Shape, Tool } from '../types/shape'

type UserHistory = {
  past: Shape[][]
  future: Shape[][]
}

type TimelineEntry = {
  id: string
  name: string
  at: number
  shapes: Shape[]
}

type WhiteboardState = {
  shapes: Shape[]
  selectedIds: string[]
  activeTool: Tool
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
  version: number//版本号。用于记录状态的变化。
  role: Role
  currentUserId: string | null
  userHistories: Record<string, UserHistory>
  timeline: TimelineEntry[]
  lastRemoteSnapshotAt: number
  setCurrentUser: (id: string) => void
  setRole: (role: Role) => void
  addShape: (shape: Shape) => void
  updateShape: (id: string, updater: (shape: Shape) => Shape) => void
  removeShapes: (ids: string[]) => void
  replaceShapes: (shapes: Shape[], updatedAt?: number) => void
  applyRemoteShape: (shape: Shape) => void//应用远程形状。用于接收和应用其他用户发送的形状数据。
  groupShapes: (ids: string[]) => void//组合形状。用于将多个形状组合成一个组。
  ungroupShapes: (ids: string[]) => void//取消组合形状。用于将多个形状取消组合。
  toggleLock: (ids: string[], locked: boolean) => void//锁定形状。用于锁定形状。
  selectShapes: (ids: string[]) => void
  clearSelection: () => void//清除选择。用于清除选择。
  setActiveTool: (tool: Tool) => void//设置活跃工具。用于设置活跃工具。
  setStroke: (color: string) => void//设置描边颜色。用于设置描边颜色。
  setFill: (color: string) => void//设置填充颜色。用于设置填充颜色。
  setStrokeWidth: (value: number) => void//设置描边宽度。用于设置描边宽度。
  setOpacity: (value: number) => void//设置不透明度。用于设置不透明度。
  addCheckpoint: (name?: string) => void
  restoreCheckpoint: (id: string) => void
  undo: () => void//撤销。用于撤销。
  redo: () => void//重做。用于重做。
  canUndo: () => boolean//是否可以撤销。用于判断是否可以撤销。
  canRedo: () => boolean//是否可以重做。用于判断是否可以重做。
}

const UNKNOWN_OWNER = 'unknown-owner'
const DEFAULT_USER_ID = 'local-user'

const cloneShape = (shape: Shape) => structuredClone(shape);
//用于创建一个单个 Shape 对象的深拷贝。

const cloneShapes = (shapes: Shape[]) => shapes.map((shape) => cloneShape(shape))
//用于创建一个**Shape 数组**（即整个白板状态）的深拷贝。

const getOwnerId = (shape: Shape) => shape.createdBy ?? UNKNOWN_OWNER

const filterUserShapes = (shapes: Shape[], userId: string) =>
  shapes.filter((shape) => getOwnerId(shape) === userId)

const trimHistory = (items: Shape[][]) =>
  items.length > 30 ? items.slice(items.length - 30) : items

const getUserHistory = (state: WhiteboardState, userId: string): UserHistory =>
  state.userHistories[userId] ?? { past: [], future: [] }

const pushUserPast = (state: WhiteboardState, userId: string): UserHistory => {
  const snapshot = cloneShapes(filterUserShapes(state.shapes, userId))//这里传userId是因为用户的撤销和重做是相互独立的，如果不传useid，将会按顺序撤销，可能会导致用户a将用户b的图形撤销掉 
  const history = getUserHistory(state, userId)
  const past = trimHistory([...history.past, snapshot])
  return { past, future: [] }
}

const mergeUserSnapshot = (state: WhiteboardState, userId: string, userSnapshot: Shape[]) => {
  const others = state.shapes.filter((shape) => getOwnerId(shape) !== userId)
  return [...others, ...cloneShapes(userSnapshot)]
}

const getActiveUserId = (state: WhiteboardState) => state.currentUserId ?? DEFAULT_USER_ID
const isReadOnly = (state: WhiteboardState) => state.role === 'viewer'

export const useWhiteboardStore = create<WhiteboardState>()(
  persist(
    (set, get) => ({
  shapes: [],//图形列表。存储白板上所有图形对象的数据。
  selectedIds: [],//选中 ID 列表。存储当前选中的图形的 ID 数组。
  activeTool: 'select',//当前活跃工具。例如：'select'（选择）、'draw'（画笔）、'rect'（矩形）等。
  stroke: '#008c8c',//当前工具的描边颜色。
  fill: 'none',//当前工具的填充颜色。
  strokeWidth: 2,//当前工具的描边宽度。
  opacity: 0.95,//当前工具的不透明度。
  version: 0,//version 是：👉 用来标记“白板状态变化次数”的计数器,在协作同步时起关键作用
  role: 'owner',
  currentUserId: null,
  userHistories: {},
  timeline: [],
  lastRemoteSnapshotAt: 0,
  // setCurrentUser: (userId) => 
  //   set((state) => ({
  //     currentUserId: userId,
  //     userHistories: state.userHistories[userId]
  //       ? state.userHistories
  //       : { ...state.userHistories, [userId]: { past: [], future: [] } },
  //   })),
  setCurrentUser:(userId)=>(
    set((state)=>({
      currentUserId:userId,
      userHistories:state.userHistories[userId]
      ?state.userHistories
      :{...state.userHistories,[userId]:{past:[],future:[]}}
    }))
  ),
    //设置当前用户 + 初始化他的历史记录
  setRole: (role) => set({ role }),
  addShape: (shape) =>
    set((state) => {
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      const ownedShape = shape.createdBy ? shape : { ...shape, createdBy: userId }
      return {
        shapes: [...state.shapes, ownedShape],
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  updateShape: (id, updater) =>
    set((state) => {
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      const shapes = state.shapes.map((shape) => (shape.id === id ? updater(shape) : shape))
      return {
        shapes,
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  removeShapes: (ids) =>
    set((state) => {
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      return {
        shapes: state.shapes.filter((shape) => !ids.includes(shape.id)),
        selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  replaceShapes: (shapes, updatedAt) =>
    set((state) => {
      if (updatedAt && updatedAt <= state.lastRemoteSnapshotAt) return state
      return {
        shapes: cloneShapes(shapes),
        lastRemoteSnapshotAt: updatedAt ?? state.lastRemoteSnapshotAt,
      }
    }),
  applyRemoteShape: (shape) =>
    set((state) => {
      const exists = state.shapes.some((item) => item.id === shape.id)
      const next = exists
        ? state.shapes.map((item) => (item.id === shape.id ? cloneShape(shape) : item))
        : [...state.shapes, cloneShape(shape)]
      return { shapes: next }
    }),
  groupShapes: (ids) =>
    set((state) => {
      if (!ids.length) return state
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      const groupId = nanoid()
      return {
        shapes: state.shapes.map((shape) =>
          ids.includes(shape.id) ? { ...shape, groupId, updatedAt: Date.now() } : shape,
        ),
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  ungroupShapes: (ids) =>
    set((state) => {
      if (!ids.length) return state
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      return {
        shapes: state.shapes.map((shape) =>
          ids.includes(shape.id) ? { ...shape, groupId: undefined, updatedAt: Date.now() } : shape,
        ),
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  toggleLock: (ids, locked) =>
    set((state) => {
      if (!ids.length) return state
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = pushUserPast(state, userId)
      return {
        shapes: state.shapes.map((shape) =>
          ids.includes(shape.id) ? { ...shape, locked, updatedAt: Date.now() } : shape,
        ),
        userHistories: { ...state.userHistories, [userId]: history },
        version: state.version + 1,
      }
    }),
  selectShapes: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setStroke: (color) => set({ stroke: color }),
  setFill: (color) => set({ fill: color }),
  setStrokeWidth: (value) => set({ strokeWidth: value }),
  setOpacity: (value) => set({ opacity: value }),
  addCheckpoint: (name) =>
    set((state) => {
      if (isReadOnly(state)) return state
      const entry: TimelineEntry = {
        id: nanoid(),
        name: name?.trim() || `快照-${new Date().toLocaleTimeString()}`,
        at: Date.now(),
        shapes: cloneShapes(state.shapes),
      }
      const timeline = [...state.timeline, entry].slice(-20)
      return { timeline }
    }),
  restoreCheckpoint: (id) =>
    set((state) => {
      if (isReadOnly(state)) return state
      const target = state.timeline.find((item) => item.id === id)
      if (!target) return state
      return {
        shapes: cloneShapes(target.shapes),
        version: state.version + 1,
      }
    }),
  undo: () =>
    set((state) => {
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = getUserHistory(state, userId)
      if (!history.past.length) return state
      const previous = history.past[history.past.length - 1]
      const currentUserShapes = filterUserShapes(state.shapes, userId)
      const nextFuture = trimHistory([cloneShapes(currentUserShapes), ...history.future])
      const nextPast = history.past.slice(0, -1)
      return {
        shapes: mergeUserSnapshot(state, userId, previous),
        userHistories: { ...state.userHistories, [userId]: { past: nextPast, future: nextFuture } },
        version: state.version + 1,
      }
    }),
  redo: () =>
    set((state) => {
      if (isReadOnly(state)) return state
      const userId = getActiveUserId(state)
      const history = getUserHistory(state, userId)
      if (!history.future.length) return state
      const [next, ...rest] = history.future
      const currentUserShapes = filterUserShapes(state.shapes, userId)
      const past = trimHistory([...history.past, cloneShapes(currentUserShapes)])
      return {
        shapes: mergeUserSnapshot(state, userId, next),
        userHistories: { ...state.userHistories, [userId]: { past, future: rest } },
        version: state.version + 1,
      }
    }),
  canUndo: () => {
    const state = get()
    const userId = getActiveUserId(state)
    return getUserHistory(state, userId).past.length > 0
  },
  canRedo: () => {
    const state = get()
    const userId = getActiveUserId(state)
    return getUserHistory(state, userId).future.length > 0
  },
  }),
  {
    name: 'whiteboard-shapes',
    partialize: (state) => ({
      shapes: state.shapes,
      version: state.version,
    }),
  },
))


