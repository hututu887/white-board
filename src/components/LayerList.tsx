import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import type { Shape } from '../types/shape'

const shapeLabel = (shape: Shape) => {
  if (shape.type === 'rect') return '矩形'
  if (shape.type === 'ellipse') return '椭圆'
  if (shape.type === 'line') return '直线'
  if (shape.type === 'free') return '铅笔'
  return '文本'
}

export function LayerList() {
  const {
    shapes,
    selectedIds,
    selectShapes,
    groupShapes,
    ungroupShapes,
    toggleLock,
  } = useWhiteboardStore(
    useShallow((state) => ({
      shapes: state.shapes,
      selectedIds: state.selectedIds,
      selectShapes: state.selectShapes,
      groupShapes: state.groupShapes,
      ungroupShapes: state.ungroupShapes,
      toggleLock: state.toggleLock,
    })),
  )

  const hasSelection = selectedIds.length > 0
  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id))
  const anyLocked = selectedShapes.some((s) => s.locked)

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>图层</span>
        <span className="text-xs text-slate-400">{shapes.length} 个元素</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-50"
          disabled={!hasSelection}
          onClick={() => groupShapes(selectedIds)}
        >
          组合
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-50"
          disabled={!hasSelection}
          onClick={() => ungroupShapes(selectedIds)}
        >
          解散
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-50"
          disabled={!hasSelection || anyLocked}
          onClick={() => toggleLock(selectedIds, true)}
        >
          锁定
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-50"
          disabled={!hasSelection || !anyLocked}
          onClick={() => toggleLock(selectedIds, false)}
        >
          解锁
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {shapes.length === 0 && (
          <div className="text-sm text-slate-500">还没有任何图形，试试左侧工具吧。</div>
        )}
        {shapes
          .slice()
          .reverse()
          .map((shape) => {
            const isActive = selectedIds.includes(shape.id)
            return (
              <button
                type="button"
                key={shape.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition hover:border-sky-400 hover:bg-sky-500/10 ${
                  isActive ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-900'
                }`}
                onClick={(event) => {
                  if (event.shiftKey) {
                    const next = isActive
                      ? selectedIds.filter((id) => id !== shape.id)
                      : [...selectedIds, shape.id]
                    selectShapes(next)
                  } else {
                    selectShapes([shape.id])
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  <span>{shapeLabel(shape)}</span>
                  {shape.locked && (
                    <span className="rounded bg-slate-800 px-1 text-[11px] text-slate-300">
                      锁
                    </span>
                  )}
                  {shape.groupId && (
                    <span className="rounded bg-slate-800 px-1 text-[11px] text-slate-300">
                      组
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-400">{shape.id.slice(0, 6)}</span>
              </button>
            )
          })}
      </div>
    </section>
  )
}

