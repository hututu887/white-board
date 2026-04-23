import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import type { Tool } from '../types/shape'

const tools: { id: Tool; label: string; shortcut: string }[] = [
  { id: 'select', label: '选择', shortcut: 'V' },
  { id: 'pencil', label: '铅笔', shortcut: 'P' },
  { id: 'rectangle', label: '矩形', shortcut: 'R' },
  { id: 'ellipse', label: '椭圆', shortcut: 'O' },
  { id: 'line', label: '直线', shortcut: 'L' },
  { id: 'text', label: '文本', shortcut: 'T' },
]

export function Toolbar() {
  const {
    activeTool,
    stroke,
    fill,
    strokeWidth,
    opacity,
    setActiveTool,
    setStroke,
    setFill,
    setStrokeWidth,
    setOpacity,
  } = useWhiteboardStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      stroke: state.stroke,
      fill: state.fill,
      strokeWidth: state.strokeWidth,
      opacity: state.opacity,
      setActiveTool: state.setActiveTool,
      setStroke: state.setStroke,
      setFill: state.setFill,
      setStrokeWidth: state.setStrokeWidth,
      setOpacity: state.setOpacity,
    })),
  )

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-xl">
      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left text-sm transition hover:border-sky-400 hover:bg-sky-500/10 ${
              activeTool === tool.id
                ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]'
                : 'border-slate-800 bg-slate-900'
            }`}
            onClick={() => setActiveTool(tool.id)}
          >
            <span>{tool.label}</span>
            <small className="text-xs text-slate-400">{tool.shortcut}</small>
          </button>
        ))}
      </div>

      <div className="h-px bg-slate-800" />
      <div className="flex flex-col gap-3 text-sm text-slate-200">
        <label className="flex flex-col gap-1">
          描边颜色
          <input
            type="color"
            className="h-10 w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900"
            value={stroke}
            onChange={(event) => setStroke(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          填充颜色
          <input
            type="color"
            className="h-10 w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900"
            value={fill}
            onChange={(event) => setFill(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          粗细：{strokeWidth}px
          <input
            className="w-full accent-sky-400"
            type="range"
            min={1}
            max={12}
            step={1}
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1">
          透明度：{Math.round(opacity * 100)}%
          <input
            className="w-full accent-sky-400"
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </label>
      </div>
    </aside>
  )
}

