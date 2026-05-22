import { CanvasSurface } from './components/CanvasSurface'
import { LayerList } from './components/LayerList'
import { PresencePanel } from './components/PresencePanel'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { CollaborationProvider } from './realtime/collaboration'

function App() {
  return (
    <CollaborationProvider>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <TopBar />
        <div className="grid h-[calc(100vh-64px)] grid-cols-[180px_1fr_320px] gap-3 px-4 pb-5">
          <Toolbar />
          <main className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <CanvasSurface />
          </main>
          <aside className="flex flex-col gap-3">
            <LayerList />
            <PresencePanel />
          </aside>
        </div>
      </div>
    </CollaborationProvider>
  )
}

export default App
