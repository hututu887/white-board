import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { useWhiteboardStore } from '../state/useWhiteboardStore'
import type { BoardSnapshot, Presence, Point, Shape } from '../types/shape'
import { createRealtimeClient, type RealtimeClient } from './socket'

type CollabStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

type CollaborationContextValue = {
  status: CollabStatus
  roomId: string
  self: Presence
  peers: Presence[]
  sendPresence: (cursor?: Point) => void
  error?: string
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null)

const pickColor = (id: string) => {
  const palette = ['#60a5fa', '#f472b6', '#34d399', '#f97316', '#a78bfa', '#2dd4bf', '#eab308']
  const hash = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

const defaultRoom = import.meta.env.VITE_ROOM_ID ?? 'demo-room'

function useProvideCollaboration(roomId?: string): CollaborationContextValue {
  const resolvedRoom = roomId || defaultRoom
  const userId = useMemo(() => nanoid(8), [])
  const [status, setStatus] = useState<CollabStatus>('idle')
  const [self, setSelf] = useState<Presence>(() => ({
    userId,
    name: '你',
    color: pickColor(userId),
    cursor: undefined,
    lastActive: Date.now(),
  }))
  const [peers, setPeers] = useState<Record<string, Presence>>({})

  const shapes = useWhiteboardStore((state) => state.shapes)
  const version = useWhiteboardStore((state) => state.version)
  const replaceShapes = useWhiteboardStore((state) => state.replaceShapes)
  const applyRemoteShape = useWhiteboardStore((state) => state.applyRemoteShape)
  const setCurrentUser = useWhiteboardStore((state) => state.setCurrentUser)

  const clientRef = useRef<RealtimeClient | null>(null)
  const skipNextBroadcast = useRef(false)
  const presenceThrottle = useRef(0)
  const snapshotTimer = useRef<number | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    setCurrentUser(userId)
  }, [userId, setCurrentUser])

  useEffect(() => {
    const client = createRealtimeClient(resolvedRoom, userId)
    clientRef.current = client
    setStatus('connecting')
    client.connect()

    const handleConnect = () => {
      setStatus('connected')
      setError(undefined)
    }
    const handleDisconnect = () => setStatus('disconnected')
    const handleError = (err: unknown) => {
      setStatus('error')
      setError(err instanceof Error ? err.message : '连接异常')
    }

    client.socket.on('connect', handleConnect)
    client.socket.on('disconnect', handleDisconnect)
    client.socket.on('connect_error', handleError)

    const offShape = client.onShape((shape: Shape) => {
      skipNextBroadcast.current = true
      applyRemoteShape(shape)
    })

    const offSnapshot = client.onSnapshot((snapshot: BoardSnapshot) => {
      skipNextBroadcast.current = true
      replaceShapes(snapshot.shapes, snapshot.updatedAt)
    })

    const offPresence = client.onPresence(({ userId: peerId, cursor }) => {
      if (peerId === userId) return
      setPeers((prev) => ({
        ...prev,
        [peerId]: {
          userId: peerId,
          name: prev[peerId]?.name ?? `用户 ${peerId.slice(0, 4)}`,
          color: prev[peerId]?.color ?? pickColor(peerId),
          cursor,
          lastActive: Date.now(),
        },
      }))
    })

    return () => {
      offShape()
      offSnapshot()
      offPresence()
      client.socket.off('connect', handleConnect)
      client.socket.off('disconnect', handleDisconnect)
      client.socket.off('connect_error', handleError)
      client.disconnect()
    }
  }, [resolvedRoom, userId, applyRemoteShape, replaceShapes])

  useEffect(() => {
    const client = clientRef.current
    if (!client || status !== 'connected') return
    if (skipNextBroadcast.current) {
      skipNextBroadcast.current = false
      return
    }
    if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current)
    snapshotTimer.current = window.setTimeout(() => {
      client.emitSnapshot({ shapes, updatedAt: Date.now() })
    }, 120)
    return () => {
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current)
    }
  }, [shapes, status, version])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setPeers((prev) => {
        const next: Record<string, Presence> = {}
        Object.values(prev).forEach((peer) => {
          if (now - peer.lastActive < 12000) {
            next[peer.userId] = peer
          }
        })
        return next
      })
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const sendPresence = useCallback(
    (cursor?: Point) => {
      const now = Date.now()
      if (now - presenceThrottle.current < 16) return
      presenceThrottle.current = now
      setSelf((prev) => ({ ...prev, cursor, lastActive: now }))
      clientRef.current?.emitPresence(cursor)
    },
    [],
  )

  const value = useMemo(
    () => ({
      status,
      roomId: resolvedRoom,
      self,
      peers: Object.values(peers),
      sendPresence,
      error,
    }),
    [status, resolvedRoom, self, peers, sendPresence, error],
  )

  return value
}

export function CollaborationProvider({
  roomId,
  children,
}: {
  roomId?: string
  children: ReactNode
}) {
  const value = useProvideCollaboration(roomId)
  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>
}

export function useCollaboration() {
  const ctx = useContext(CollaborationContext)
  if (!ctx) throw new Error('useCollaboration 必须在 CollaborationProvider 内使用')
  return ctx
}


