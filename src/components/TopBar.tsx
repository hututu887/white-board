 import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import { exportSvgToPng } from '../utils/exporter'

export function TopBar() {
  const { undo, redo, canUndo, canRedo, activeTool, addCheckpoint, restoreCheckpoint, timeline } = useWhiteboardStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      // 直接选择布尔值，确保 past/future 变化能触发重渲染
      canUndo: state.canUndo(),
      canRedo: state.canRedo(),
      activeTool: state.activeTool,
      addCheckpoint: state.addCheckpoint,
      restoreCheckpoint: state.restoreCheckpoint,
      timeline: state.timeline,
    })),
  )

  const [exporting, setExporting] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)

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
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-400 shadow-[0_8px_24px_rgba(99,102,241,0.35)]" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold tracking-tight text-slate-800">
            Realtime Whiteboard
          </span>
          <span className="text-xs text-slate-400">React · Canvas · Socket.IO</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-600">
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
        <div className="relative">
          <button className={buttonClass} onClick={() => addCheckpoint()}>
            保存快照
          </button>
          <button
            className={buttonClass}
            onClick={() => setShowTimeline((prev) => !prev)}
            disabled={timeline.length === 0}
          >
            快照记录 {timeline.length > 0 && `(${timeline.length})`}
          </button>
          {showTimeline && timeline.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTimeline(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-400">
                  点击恢复至对应快照
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {[...timeline].reverse().map((entry) => (
                    <button
                      key={entry.id}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50"
                      onClick={() => {
                        restoreCheckpoint(entry.id)
                        setShowTimeline(false)
                      }}
                    >
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(entry.at).toLocaleTimeString()} · {entry.shapes.length} 个图形
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

