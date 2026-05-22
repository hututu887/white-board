import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import type { Tool } from '../types/shape'

const tools: { id: Tool; label: string; shortcut: string; icon: string }[] = [
  { id: 'select', label: '选择工具', shortcut: 'V', icon: '↖' },
  { id: 'pencil', label: '铅笔', shortcut: 'P', icon: '✏' },
  { id: 'rectangle', label: '矩形', shortcut: 'R', icon: '▢' },
  { id: 'ellipse', label: '椭圆', shortcut: 'O', icon: '○' },
  { id: 'line', label: '直线', shortcut: 'L', icon: '╱' },
  { id: 'text', label: '文本', shortcut: 'T', icon: 'T' },
]

const strokePresets = ['#008c8c', '#ef4444', '#6366f1', '#f59e0b', '#10b981', '#ec4899']
const fillPresets = ['none', '#e0e7ff', '#fef3c7', '#dcfce7', '#fce7f3', '#e0f2fe']

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
    <aside className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-lg">
      {/* 工具按钮 — 单列 */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-indigo-400 hover:bg-indigo-50 ${
            activeTool === tool.id
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]'
              : 'border-slate-200 bg-white text-slate-600'
          }`}
          onClick={() => setActiveTool(tool.id)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-base">
            {tool.icon}
          </span>
          <span className="flex-1 text-sm font-medium">{tool.label}</span>
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
            {tool.shortcut}
          </kbd>
        </button>
      ))}

      <div className="h-px bg-slate-200 my-1" />

      {/* 描边颜色 */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-slate-400">描边颜色</div>
        <div className="flex flex-wrap gap-1.5">
          {strokePresets.map((color) => (
            <button
              key={color}
              type="button"
              className={`h-7 w-7 rounded-lg border-2 transition hover:scale-110 ${
                stroke === color ? 'border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.3)]' : 'border-slate-200'
              }`}
              style={{ background: color === 'none' ? '#fff' : color }}
              onClick={() => setStroke(color)}
            >
              {color === 'none' && <span className="text-[10px] text-slate-300">╳</span>}
            </button>
          ))}
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-0"
            value={stroke === 'none' ? '#000000' : stroke}
            onChange={(event) => setStroke(event.target.value)}
          />
        </div>
      </div>

      {/* 填充颜色 */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-slate-400">填充颜色</div>
        <div className="flex flex-wrap gap-1.5">
          {fillPresets.map((color) => (
            <button
              key={color}
              type="button"
              className={`h-7 w-7 rounded-lg border-2 transition hover:scale-110 ${
                fill === color ? 'border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.3)]' : 'border-slate-200'
              }`}
              style={{ background: color === 'none' ? '#fff' : color }}
              onClick={() => setFill(color)}
            >
              {color === 'none' && <span className="text-[10px] text-slate-300">╳</span>}
            </button>
          ))}
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-0"
            value={fill === 'none' ? '#000000' : fill}
            onChange={(event) => setFill(event.target.value)}
          />
        </div>
      </div>

      <div className="h-px bg-slate-200 my-1" />

      {/* 粗细 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">描边粗细</span>
          <span className="text-[11px] font-semibold text-slate-500">{strokeWidth}px</span>
        </div>
        <input
          className="w-full accent-indigo-500"
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={strokeWidth}
          onChange={(event) => setStrokeWidth(Number(event.target.value))}
        />
      </div>

      {/* 透明度 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">透明度</span>
          <span className="text-[11px] font-semibold text-slate-500">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          className="w-full accent-indigo-500"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
        />
      </div>
    </aside>
  )
}
