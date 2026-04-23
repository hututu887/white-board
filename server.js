import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  const { roomId, userId } = socket.handshake.query
  const room = roomId || 'demo-room'
  socket.join(room)
  console.log('joined', room, userId)

  const broadcast = (event) => (payload) => socket.to(room).emit(event, payload)
  socket.on('shape:update', broadcast('shape:update'))
  socket.on('board:snapshot', broadcast('board:snapshot'))
  socket.on('presence', broadcast('presence'))

  socket.on('disconnect', () => console.log('left', room, userId))
})

httpServer.listen(3001, () => console.log('ws on 3001'))