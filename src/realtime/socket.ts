import { io } from 'socket.io-client'
import type { BoardSnapshot, Point, Shape } from '../types/shape'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'

export type RealtimeClient = ReturnType<typeof createRealtimeClient>

export function createRealtimeClient(roomId: string, userId: string) {
  const socket = io(WS_URL, {
    autoConnect: false,
    transports: ['websocket'],
    query: { roomId, userId },
  })

  const connect = () => socket.connect()
  const disconnect = () => socket.disconnect()

  const emitShape = (shape: Shape) => socket.emit('shape:update', shape)
  const emitSnapshot = (snapshot: BoardSnapshot) =>
    socket.emit('board:snapshot', snapshot)
  const emitPresence = (cursor: Point | undefined) =>
    socket.emit('presence', { userId, cursor })

  const onShape = (handler: (shape: Shape) => void) => {
    socket.on('shape:update', handler)
    return () => socket.off('shape:update', handler)
  }

  const onSnapshot = (handler: (snapshot: BoardSnapshot) => void) => {
    socket.on('board:snapshot', handler)
    return () => socket.off('board:snapshot', handler)
  }

  const onPresence = (
    handler: (payload: { userId: string; cursor?: Point }) => void,
  ) => {
    socket.on('presence', handler)
    return () => socket.off('presence', handler)
  }

  return {
    socket,
    connect,
    disconnect,
    emitShape,
    emitSnapshot,
    emitPresence,
    onShape,
    onSnapshot,
    onPresence,
  }
}


