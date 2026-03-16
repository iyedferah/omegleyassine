// server.js — Custom Next.js + Socket.io server
// Handles matchmaking, WebRTC signaling, and text chat relay.
// Video/audio streams go DIRECTLY between browsers (WebRTC P2P) —
// the server is only used for signaling, so it scales well even at 1000+ users.

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ─── Matchmaking State ────────────────────────────────────────────────────────
// Separate queues per mode — each entry: { id: socketId, interests: string[] }
// FIFO: O(1) amortized matching (push to end, shift from front when matched)
const queues = {
  video: [],
  text: [],
}

// roomId → { members: Set<socketId> }
const rooms = new Map()

// socketId → roomId  (for O(1) reverse lookup on disconnect)
const socketRoom = new Map()

// socketId → mode
const socketMode = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find the best match in a queue for a given socket.
 * Priority: interest overlap → any available user.
 * Falls back to FIFO if no interest overlap is found.
 */
function findMatch(queue, socketId, interests) {
  if (queue.length === 0) return null

  // 1. Try to find someone with overlapping interests
  if (interests.length > 0) {
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i]
      if (candidate.id === socketId) continue
      const hasOverlap = interests.some(tag =>
        candidate.interests.includes(tag)
      )
      if (hasOverlap) {
        queue.splice(i, 1)
        return candidate
      }
    }
  }

  // 2. Fallback: take the first person in queue (FIFO)
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].id !== socketId) {
      return queue.splice(i, 1)[0]
    }
  }

  return null
}

/**
 * Remove a socket from whichever queue it's in.
 */
function removeFromQueue(socketId) {
  for (const queue of Object.values(queues)) {
    const idx = queue.findIndex(u => u.id === socketId)
    if (idx !== -1) {
      queue.splice(idx, 1)
      return
    }
  }
}

/**
 * Clean up a room when either user leaves or disconnects.
 * Notifies the remaining partner.
 */
function leaveRoom(io, socket) {
  const roomId = socketRoom.get(socket.id)
  if (!roomId) return

  // Notify partner
  socket.to(roomId).emit('partner-left')

  // Remove all members from the room
  const room = rooms.get(roomId)
  if (room) {
    room.members.forEach(memberId => {
      socketRoom.delete(memberId)
      const s = io.sockets.sockets.get(memberId)
      s?.leave(roomId)
    })
    rooms.delete(roomId)
  }
}

// ─── Server Bootstrap ─────────────────────────────────────────────────────────

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const io = new Server(httpServer, {
    // Allow all origins in dev; restrict in production
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    // Tuning for many concurrent connections
    pingTimeout: 20000,
    pingInterval: 25000,
    // Use websocket first, polling as fallback
    transports: ['websocket', 'polling'],
  })

  // ─── Socket Events ──────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    const clientCount = io.engine.clientsCount
    if (dev) console.log(`[+] ${socket.id} connected | total: ${clientCount}`)

    // ── Join Queue ────────────────────────────────────────────────────────────
    socket.on('join-queue', ({ mode = 'video', interests = [] } = {}) => {
      // Validate mode
      const queueKey = mode === 'text' ? 'text' : 'video'
      const queue = queues[queueKey]

      socketMode.set(socket.id, queueKey)

      // Make sure socket isn't already in a room
      const existingRoom = socketRoom.get(socket.id)
      if (existingRoom) {
        leaveRoom(io, socket)
      }

      // Normalize interests: lowercase, trim, max 10
      const normalizedInterests = (Array.isArray(interests) ? interests : [])
        .map(i => String(i).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 10)

      const match = findMatch(queue, socket.id, normalizedInterests)

      if (match) {
        // ── Pair found — create room ─────────────────────────────────────────
        const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`
        rooms.set(roomId, { members: new Set([socket.id, match.id]) })
        socketRoom.set(socket.id, roomId)
        socketRoom.set(match.id, roomId)

        socket.join(roomId)
        io.sockets.sockets.get(match.id)?.join(roomId)

        // The newly joined user is the initiator (creates the WebRTC offer)
        socket.emit('matched', { roomId, initiator: true })
        io.to(match.id).emit('matched', { roomId, initiator: false })

        if (dev) console.log(`[~] Matched ${socket.id} ↔ ${match.id} in ${roomId}`)
      } else {
        // ── No match yet — add to queue ──────────────────────────────────────
        // Avoid duplicates in queue
        if (!queue.find(u => u.id === socket.id)) {
          queue.push({ id: socket.id, interests: normalizedInterests })
        }
        socket.emit('waiting', { position: queue.length })
        if (dev) console.log(`[~] ${socket.id} waiting in ${queueKey} queue (len: ${queue.length})`)
      }
    })

    // ── Leave Queue (cancel waiting before match) ─────────────────────────────
    socket.on('leave-queue', () => {
      removeFromQueue(socket.id)
      socket.emit('queue-left')
    })

    // ── Leave Room (Next / Stop) ──────────────────────────────────────────────
    socket.on('leave-room', () => {
      leaveRoom(io, socket)
      if (dev) console.log(`[~] ${socket.id} left their room`)
    })

    // ── WebRTC Signaling Relay ────────────────────────────────────────────────
    // The server never sees video data — it only relays the tiny handshake signals
    socket.on('signal', ({ roomId, signal }) => {
      // Security: only relay if this socket is actually in the room
      const myRoom = socketRoom.get(socket.id)
      if (myRoom !== roomId) return
      socket.to(roomId).emit('signal', { signal })
    })

    // ── Text Chat Relay ───────────────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, text }) => {
      if (!text || typeof text !== 'string') return
      const trimmed = text.trim().slice(0, 500) // max 500 chars
      if (!trimmed) return

      const myRoom = socketRoom.get(socket.id)
      if (myRoom !== roomId) return

      socket.to(roomId).emit('chat-message', { text: trimmed })
    })

    // ── Stats ─────────────────────────────────────────────────────────────────
    socket.on('get-stats', () => {
      const waitingCount = queues.video.length + queues.text.length
      socket.emit('stats', {
        online: io.engine.clientsCount,
        waiting: waitingCount,
        chatting: rooms.size * 2,
        rooms: rooms.size,
      })
    })

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      leaveRoom(io, socket)
      removeFromQueue(socket.id)
      socketMode.delete(socket.id)
      if (dev) console.log(`[-] ${socket.id} disconnected (${reason}) | total: ${io.engine.clientsCount}`)
    })
  })

  // ─── Periodic Stats Log (dev only) ─────────────────────────────────────────
  if (dev) {
    setInterval(() => {
      console.log(
        `[stats] online=${io.engine.clientsCount} | rooms=${rooms.size} | ` +
        `queue_video=${queues.video.length} | queue_text=${queues.text.length}`
      )
    }, 30_000)
  }

  // ─── Start ─────────────────────────────────────────────────────────────────
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Mode: ${dev ? 'development' : 'production'}`)
  })
})
