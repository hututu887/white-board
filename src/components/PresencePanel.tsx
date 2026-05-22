import { useMemo } from 'react'
import { useCollaboration } from '../realtime/collaboration'

export function PresencePanel() {
  const { status, self, peers, error } = useCollaboration()
  const now = Date.now()
  const users = useMemo(
    () =>
      [self, ...peers].map((user) => ({
        ...user,
        active: now - user.lastActive < 12000,
      })),
    [now, peers, self],
  )

  const statusText: Record<string, string> = {
    connected: '已连接',
    connecting: '连接中',
    disconnected: '已断开',
    error: '连接异常',
    idle: '未连接',
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>协作</span>
        <span className="text-xs text-slate-400">
          {statusText[status] ?? status} · {users.length} 人
        </span>
      </div>
      {error && <div className="mb-2 text-xs text-amber-600">连接异常：{error}</div>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        {users.map((item) => (
          <div
            key={item.userId}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: item.color,
                opacity: item.active ? 1 : 0.35,
                boxShadow: item.active ? `0 0 0 3px ${item.color}33` : undefined,
              }}
            />
            <div>
              <div className="font-semibold text-slate-700">{item.name}</div>
              <div className="text-xs text-slate-400">
                {item.active ? '在线' : '暂未活跃'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


