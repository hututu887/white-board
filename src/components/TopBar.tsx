 import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import { exportSvgToPng } from '../utils/exporter'

export function TopBar() {
  const { undo, redo, canUndo, canRedo, activeTool } = useWhiteboardStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      // 直接选择布尔值，确保 past/future 变化能触发重渲染
      canUndo: state.canUndo(),
      canRedo: state.canRedo(),
      activeTool: state.activeTool,
    })),
  )

  // const [exporting, setExporting] = useState(false)
  const [exporting,setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    try {
      setExporting(true)
      await exportSvgToPng('whiteboard-svg', 'whiteboard.png')
    } catch (error) {
      console.error('导出失败', error)
    } finally {
      setExporting(false)
    }
  }, [])

  const buttonClass =
    'rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition hover:border-sky-400 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-violet-400 shadow-[0_10px_30px_rgba(56,189,248,0.45)]" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold tracking-tight">
            Realtime Whiteboard
          </span>
          <span className="text-xs text-slate-400">React · Canvas · Socket.IO</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-1 text-xs text-sky-100">
          当前工具：{activeTool}
        </span>
        <button className={buttonClass} onClick={undo} disabled={!canUndo}>
          撤销
        </button>
        <button className={buttonClass} onClick={redo} disabled={!canRedo}>
          重做
        </button>
        <button className={buttonClass} onClick={handleExport} disabled={exporting}>
          {exporting ? '导出中…' : '导出 PNG'}
        </button>
      </div>
    </header>
  )
}

