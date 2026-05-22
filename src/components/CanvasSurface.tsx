import { nanoid } from 'nanoid'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import type { Point, Shape, Tool } from '../types/shape'
import { useCollaboration } from '../realtime/collaboration'

type DraftShape = {
  origin: Point
  shape: Shape
}

type TextEditing = {
  id: string
  value: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

type DragSession = {
  startPoint: Point
  shapeIds: string[]
  startPositions: { id: string; x: number; y: number }[]
}

const MIN_SHAPE_SIZE = 4
//最小形状大小，用于限制形状大小。
const MIN_SCALE = 0.25
const MAX_SCALE = 3
//缩放大小范围，用于限制缩放比例。

const normalizeBox = (a: Point, b: Point) => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(a.x - b.x)
  const h = Math.abs(a.y - b.y)
  return { x, y, w, h }
}//输入对角线两点的坐标，输出一个矩形的点坐标与长宽，用于计算矩形包围盒的函数

const boundsFromPoints = (points: Point[]) => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}//用于计算路径包围盒的函数（直线与铅笔所画的包围盒，方便选择）

const createBaseShape = (
  tool: Exclude<Tool, 'select'>,//Tool本身是联合类型，Exclude<Tool, 'select'>表示Tool类型中排除'select'类型，即Tool类型中除了'select'类型以外的类型。
  point: Point,
  stroke: string,
  fill: string,
  strokeWidth: number,
  opacity: number,
  createdBy: string,
): Shape => ({
  id: nanoid(),
  type: tool === 'pencil' ? 'free' : tool === 'rectangle' ? 'rect' : tool,
  x: point.x,
  y: point.y,
  w: 0, 
  h: 0,
  rotation: 0,//初始旋转角度
  stroke,
  fill,
  strokeWidth,
  opacity,
  locked: false,
  createdBy,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
//创建默认通用形状

export function CanvasSurface() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const {
    shapes,
    selectedIds,
    activeTool,
    stroke,
    fill,
    strokeWidth,
    opacity,
    addShape,
    updateShape,
    selectShapes,
    removeShapes,
    setActiveTool,
    clearSelection,
  } = useWhiteboardStore(
    useShallow((state) => ({
      shapes: state.shapes,
      selectedIds: state.selectedIds,
      activeTool: state.activeTool,
      stroke: state.stroke,
      fill: state.fill,
      strokeWidth: state.strokeWidth,
      opacity: state.opacity,
      addShape: state.addShape,
      updateShape: state.updateShape,
      selectShapes: state.selectShapes,
      removeShapes: state.removeShapes,
      setActiveTool: state.setActiveTool,
      clearSelection: state.clearSelection,
    })),
  )//选择器，选择相关状态，仅当被选择状态改变，才触发重渲染

  const { sendPresence, peers, self } = useCollaboration()

  const [draft, setDraft] = useState<DraftShape | null>(null)//<>内为可选类型，表示可以为null。draft变量为DraftShape类型或null。
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })//<>内为必选类型，表示不能为null。pan变量为Point类型。
  const [scale, setScale] = useState(1)//缩放
  const [panSession, setPanSession] = useState<{
    startClient: Point//鼠标按下时客户端的坐标
    startPan: Point//鼠标按下时平移的坐标
  } | null>(null)
  const [dragSession, setDragSession] = useState<DragSession | null>(null)
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 })
  const dragDoneRef = useRef(false)
  const [editing, setEditing] = useState<TextEditing | null>(null)//文本内容
  const inputRef = useRef<HTMLInputElement | null>(null)//准备一个input容器

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  //主要用于限制缩放级别
  
  const toCanvasPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const bounds = svgRef.current?.getBoundingClientRect()//获取svg在页面中的位置
    //getBoundingClientRect() 是什么？它返回 SVG 元素在 浏览器视口中的位置和大小：
    const x = (event.clientX - (bounds?.left ?? 0) - pan.x) / scale
    const y = (event.clientY - (bounds?.top ?? 0) - pan.y) / scale
    //坐标计算方式：浏览器视图绝对位置-svg元素相对于浏览器的位置-画布偏移位置
    return { x, y }
  }
  //将用户在浏览器窗口中点击或移动鼠标时产生的屏幕坐标（Screen Coordinates，即 clientX/clientY），转换为白板内部世界坐标（World/Canvas Coordinates）。


  
  const toScreenPoint = (point: Point) => ({
    x: point.x * scale + pan.x,
    y: point.y * scale + pan.y,
  })
  //实现世界画布坐标向屏幕坐标转换，返回SVG 内部坐标系里的坐标

  // const hitTest = (point: Point) => {
  //   for (let i = shapes.length - 1; i >= 0; i -= 1) {
  //     const shape = shapes[i]
  //     const withinX = point.x >= shape.x && point.x <= shape.x + shape.w
  //     const withinY = point.y >= shape.y && point.y <= shape.y + shape.h
  //     if (withinX && withinY) {
  //       return shape.id
  //     }
  //   }
  //   return undefined 
  // }
  const hitTest = (point: Point) => {
    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      const shape = shapes[i]
  
      if (shape.type === 'free' && shape.points) {
        if (hitTestPath(shape.points, point)) {
          return shape.id
        }
      } else {
        // 矩形等还是用原来的
        const withinX = point.x >= shape.x && point.x <= shape.x + shape.w
        const withinY = point.y >= shape.y && point.y <= shape.y + shape.h
        if (withinX && withinY) {
          return shape.id
        }
      }
    }
    return undefined
  }
  function hitTestPath(points: Point[], p: Point, tolerance = 5) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
  
      const dist = distanceToSegment(p, a, b)
      if (dist <= tolerance) {
        return true
      }
    }
    return false
  }
  function distanceToSegment(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x
    const dy = b.y - a.y
  
    if (dx === 0 && dy === 0) {
      return Math.hypot(p.x - a.x, p.y - a.y)
    }
  
    const t =
      ((p.x - a.x) * dx + (p.y - a.y) * dy) /
      (dx * dx + dy * dy)
  
    const clampedT = Math.max(0, Math.min(1, t))
  
    const projX = a.x + clampedT * dx
    const projY = a.y + clampedT * dy
  
    return Math.hypot(p.x - projX, p.y - projY)
  }
  // hitTest 的作用就是给“选择/命中检测”用，返回点下的第一个图形 id，为选中或后续交互提供依据。没命中时则进入平移模式。代码调用处
  // src/components/CanvasSurface.tsx
  // const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
  //   ...
  //   if (activeTool === 'select') {
  //     const id = hitTest(point)
  //     if (id) {
  //       selectShapes([id])
  //     } else {
  //       setPanSession({ ... })
  //       event.currentTarget.setPointerCapture(event.pointerId)
  //     }
  //     return
  //   }
  //   ...
  // }

  const startDraft = (tool: Exclude<Tool, 'select'>, start: Point, createdBy: string) => {
    const base = createBaseShape(tool, start, stroke, fill, strokeWidth, opacity, createdBy)
    if (tool === 'text') {
      addShape({
        ...base,
        type: 'text',
        text: '文本',
        w: 120,
        h: 32,
      })
      return
    }

    if (tool === 'line') {
      const shape: Shape = {
        ...base,
        type: 'line',
        points: [start, start],
      }
      setDraft({ origin: start, shape })
      return
    }

    if (tool === 'pencil') {
      const shape: Shape = {
        ...base,
        type: 'free',
        points: [start],
      }
      setDraft({ origin: start, shape })
      return
    }

    setDraft({ origin: start, shape: base })
  }

  // 扩展组内联动：如果图形有 groupId，返回同组所有图形的 id
  const getGroupIds = (shapeId: string): string[] => {
    const shape = shapes.find((item) => item.id === shapeId)
    if (!shape?.groupId) return [shapeId]
    return shapes
      .filter((item) => item.groupId === shape.groupId && !item.locked)
      .map((item) => item.id)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary) return
    const point = toCanvasPoint(event)
    sendPresence(point)
    if (activeTool === 'select') {
      const id = hitTest(point)
      if (id) {
        const groupIds = getGroupIds(id)

        // 按住 Shift → 多选切换，不触发拖拽
        if (event.shiftKey) {
          const exists = selectedIds.includes(id)
          const next = exists
            ? selectedIds.filter((item) => !groupIds.includes(item))
            : [...selectedIds, ...groupIds]
          selectShapes(next)
          return
        }

        // 点击已选中的图形（或其组成员）→ 保持多选 + 启动拖拽
        if (groupIds.some((gid) => selectedIds.includes(gid))) {
          const merged = [...new Set([...selectedIds, ...groupIds])]
          const dragIds = merged.filter((sid) => {
            const s = shapes.find((item) => item.id === sid)
            return s && !s.locked
          })
          selectShapes(merged)
          if (dragIds.length > 0) {
            dragDoneRef.current = false
            setDragSession({
              startPoint: point,
              shapeIds: dragIds,
              startPositions: dragIds.map((sid) => {
                const s = shapes.find((item) => item.id === sid)!
                return { id: sid, x: s.x, y: s.y }
              }),
            })
            setDragOffset({ x: 0, y: 0 })
            dragOffsetRef.current = { x: 0, y: 0 }
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          return
        }

        // 点击未选中的图形 → 选中整组 + 启动拖拽
        selectShapes(groupIds)
        const dragIds = groupIds.filter((sid) => {
          const s = shapes.find((item) => item.id === sid)
          return s && !s.locked
        })
        if (dragIds.length > 0) {
          dragDoneRef.current = false
          setDragSession({
            startPoint: point,
            shapeIds: dragIds,
            startPositions: dragIds.map((sid) => {
              const s = shapes.find((item) => item.id === sid)!
              return { id: sid, x: s.x, y: s.y }
            }),
          })
          setDragOffset({ x: 0, y: 0 })
          dragOffsetRef.current = { x: 0, y: 0 }
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        return
      }
      // 点击空白 → 取消选中 + 平移
      clearSelection()
      setPanSession({
        startClient: { x: event.clientX, y: event.clientY },
        startPan: pan,
      })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    event.preventDefault()
    startDraft(activeTool as Exclude<Tool, 'select'>, point, self.userId)
  }
  // handlePointerDown 是鼠标按下事件的处理函数，它会在用户按下鼠标时被调用。
  //首先对主触控进行筛选，随后检查工具是否为选择工具。如果是，则调用hitTest函数检查是否命中图形。如果命中，则根据shift状态判断进行单选或多选；如果未命中，则记录瞬时坐标以及初始偏移量。
//if（isp主触控）return；
//const point = toCanvasPoint(event)
//if(activeTool === 'select')
//const id = hitTest(point)
//if(id)
//if(shiftKey)
//const exists = selectedIds.includes(id)
//const next = exists ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]
//selectShapes(next)
//else
//selectShapes([id])
//else
//setPanSession({ startClient: { x: event.clientX, y: event.clientY }, startPan: pan })

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    sendPresence(toCanvasPoint(event))
    if (panSession) {
      const dx = event.clientX - panSession.startClient.x
      const dy = event.clientY - panSession.startClient.y
      setPan({ x: panSession.startPan.x + dx, y: panSession.startPan.y + dy })
      return
    }
    if (dragSession) {
      const current = toCanvasPoint(event)
      const offset = {
        x: current.x - dragSession.startPoint.x,
        y: current.y - dragSession.startPoint.y,
      }
      dragOffsetRef.current = offset
      setDragOffset(offset)
      return
    }
    if (!draft) return
    const current = toCanvasPoint(event)
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft
      const shape = { ...currentDraft.shape, updatedAt: Date.now() }
      if (shape.type === 'free' && shape.points) {
        shape.points = [...shape.points, current]
        const box = boundsFromPoints(shape.points)
        shape.x = box.x
        shape.y = box.y
        shape.w = box.w
        shape.h = box.h
      } else if (shape.type === 'line' && shape.points) {
        shape.points = [currentDraft.origin, current]
        const box = boundsFromPoints(shape.points)
        shape.x = box.x
        shape.y = box.y
        shape.w = box.w
        shape.h = box.h
      } else {
        const box = normalizeBox(currentDraft.origin, current)
        shape.x = box.x
        shape.y = box.y
        shape.w = box.w
        shape.h = box.h
      }
      return { origin: currentDraft.origin, shape }
    })
  }

  const finalizeDraft = () => {
    if (!draft) return
    const shape = draft.shape
    const tooSmall =
      shape.type !== 'free' &&
      shape.type !== 'line' &&
      shape.w < MIN_SHAPE_SIZE &&
      shape.h < MIN_SHAPE_SIZE
    const hasEnoughPoints = shape.points ? shape.points.length > 1 : true
    if (!tooSmall && hasEnoughPoints) {
      addShape({ ...shape })
    }
    setDraft(null)
  }

  const handlePointerUp = () => {
    sendPresence(undefined)
    if (panSession) {
      setPanSession(null)
      return
    }
    if (dragSession) {
      if (dragDoneRef.current) return
      dragDoneRef.current = true
      const offset = dragOffsetRef.current
      if (offset.x !== 0 || offset.y !== 0) {
        dragSession.startPositions.forEach(({ id, x, y }) => {
          const nx = x + offset.x
          const ny = y + offset.y
          updateShape(id, (shape) => {
            const updated: Shape = {
              ...shape,
              x: nx,
              y: ny,
              updatedAt: Date.now(),
            }
            if ((shape.type === 'free' || shape.type === 'line') && shape.points) {
              updated.points = shape.points.map((p) => ({
                x: p.x + offset.x,
                y: p.y + offset.y,
              }))
            }
            return updated
          })
        })
      }
      setDragSession(null)
      setDragOffset({ x: 0, y: 0 })
      dragOffsetRef.current = { x: 0, y: 0 }
      return
    }
    finalizeDraft()
  }

  const handlePointerLeave = () => {
    sendPresence(undefined)
    handlePointerUp()
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return
    const clientX = event.clientX - bounds.left
    const clientY = event.clientY - bounds.top
    const delta = -event.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    const nextScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
    const worldX = (clientX - pan.x) / scale
    const worldY = (clientY - pan.y) / scale
    setPan({
      x: clientX - worldX * nextScale,
      y: clientY - worldY * nextScale,
    })
    setScale(nextScale)
  }

  const handleDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== 'select') return
    const point = toCanvasPoint(event as unknown as React.PointerEvent<SVGSVGElement>)
    const id = hitTest(point)
    if (!id) return
    const shape = shapes.find((item) => item.id === id)
    if (!shape || shape.type !== 'text' || shape.locked) return
    const leftTop = toScreenPoint({ x: shape.x + 4, y: shape.y + 4 })
    setEditing({
      id,
      value: shape.text ?? '文本',
      x: leftTop.x,
      y: leftTop.y,
      w: (shape.w || 160) * scale,
      h: (shape.h || 32) * scale,
      color: shape.stroke,
    })
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // 键盘快捷键：删除 + 工具切换
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 正在编辑文本时不拦截按键
      if (editing) return
      // 焦点在 input/textarea 上时不拦截
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Delete / Backspace → 删除选中图形（跳过锁定的）
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useWhiteboardStore.getState()
        const ids = state.selectedIds.filter((sid) => {
          const s = state.shapes.find((item) => item.id === sid)
          return s && !s.locked
        })
        if (ids.length > 0) {
          e.preventDefault()
          removeShapes(ids)
        }
        return
      }

      // 工具快捷键（不区分大小写，不拦截 Ctrl/Meta 组合键）
      if (e.ctrlKey || e.metaKey) return
      const keyMap: Record<string, Tool> = {
        v: 'select',
        p: 'pencil',
        r: 'rectangle',
        o: 'ellipse',
        l: 'line',
        t: 'text',
      }
      const tool = keyMap[e.key.toLowerCase()]
      if (tool) {
        e.preventDefault()
        setActiveTool(tool)
      }

      // Escape → 取消选中
      if (e.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, removeShapes, setActiveTool, clearSelection])

  const commitEditing = (newValue: string) => {
    const target = editing
    if (!target) return
    const trimmed = newValue.trim()
    if (!trimmed) {
      setEditing(null)
      return
    }
    updateShape(target.id, (shape) => ({
      ...shape,
      text: trimmed,
      updatedAt: Date.now(),
    }))
    setEditing(null)
  }

  const renderShape = (shape: Shape) => {
    const isSelected = selectedIds.includes(shape.id)
    const selectedClass = isSelected
      ? 'filter drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]'
      : ''
    const common = {
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      opacity: shape.opacity,
      className: selectedClass,
    }
    if (shape.type === 'rect') {
      return (
        <rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          fill={shape.fill ?? 'none'}
          {...common}
        />
      )
    }
    if (shape.type === 'ellipse') {
      return (
        <ellipse
          key={shape.id}
          cx={shape.x + shape.w / 2}
          cy={shape.y + shape.h / 2}
          rx={shape.w / 2}
          ry={shape.h / 2}
          fill={shape.fill ?? 'none'}
          {...common}
        />
      )
    }
    if (shape.type === 'line') {
      const [start = { x: shape.x, y: shape.y }, end = { x: shape.x, y: shape.y }] =
        shape.points ?? []
      return (
        <line
          key={shape.id}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          fill="none"
          {...common}
        />
      )
    }
    if (shape.type === 'free') {
      const points = (shape.points ?? []).map((p) => `${p.x},${p.y}`).join(' ')
      return (
        <polyline
          key={shape.id}
          points={points}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...common}
        />
      )
    }
    return (
      <text
        key={shape.id}
        x={shape.x + 8}
        y={shape.y + 24}
        fill={shape.stroke}
        className={`${selectedClass} font-semibold tracking-tight`}
        style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 1 }}
      >
        {shape.text ?? '文本'}
      </text>
    )
  }

  return (
    <div className="relative h-full w-full">
      <svg
        id="whiteboard-svg"
        ref={svgRef}
        className="board-grid block h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {shapes.map((shape) => {
            const el = renderShape(shape)
            if (dragSession && dragSession.shapeIds.includes(shape.id)) {
              return (
                <g key={shape.id} transform={`translate(${dragOffset.x} ${dragOffset.y})`}>
                  {el}
                </g>
              )
            }
            return el
          })}
          {draft && <g>{renderShape(draft.shape)}</g>}
          {peers
            .filter((peer) => peer.cursor)
            .map((peer) => (
              <g key={peer.userId} transform={`translate(${peer.cursor!.x} ${peer.cursor!.y})`}>
                <circle r={5} fill={peer.color} opacity={0.8} />
                <text
                  x={8}
                  y={-8}
                  className="text-xs font-semibold"
                  fill={peer.color}
                  style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 1 }}
                >
                  {peer.name}
                </text>
              </g>
            ))}
        </g>
      </svg>
      {editing && (
        <input
          ref={inputRef}
          className="absolute rounded-md border border-sky-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-lg outline-none"
          style={{
            left: editing.x,
            top: editing.y,
            width: editing.w,
            height: editing.h,
          }}
          value={editing.value}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
          onBlur={(e) => commitEditing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEditing((e.target as HTMLInputElement).value)
            }
            if (e.key === 'Escape') {
              setEditing(null)
            }
          }}
        />
      )}
      <div className="pointer-events-none absolute left-3 bottom-3 rounded-md border border-slate-200 bg-white/80 px-2 py-1 text-xs text-slate-500">
        缩放 {Math.round(scale * 100)}%
      </div>
    </div>
  )
}

