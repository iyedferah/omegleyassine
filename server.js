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
// Separate queues per mode (FIFO)
const queues = {
  video: [],
  text: [],
}

// interest -> { mode -> Set<socketId> }
// Allows O(1) lookup: does anyone with interest 'gaming' want 'video' chat?
const interestMap = new Map()

// roomId → { members: Set<socketId> }
const rooms = new Map()

// socketId -> roomId (for O(1) reverse lookup)
const socketRoom = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addToInterestMap(socketId, mode, interests) {
  interests.forEach(tag => {
    if (!interestMap.has(tag)) interestMap.set(tag, { video: new Set(), text: new Set() })
    interestMap.get(tag)[mode].add(socketId)
  })
}

function removeFromInterestMap(socketId, mode, interests) {
  interests.forEach(tag => {
    const entry = interestMap.get(tag)
    if (entry) {
      entry[mode].delete(socketId)
      if (entry.video.size === 0 && entry.text.size === 0) interestMap.delete(tag)
    }
  })
}

/**
 * Find the best match in a queue for a given socket.
 * Priority: Interest overlap (O(1) via Map) -> Generic FIFO (O(1) via shift)
 */
function findMatch(mode, socketId, interests) {
  const queue = queues[mode]
  if (queue.length === 0) return null

  // 1. Try to find someone with overlapping interests
  if (interests.length > 0) {
    for (const tag of interests) {
      const candidates = interestMap.get(tag)?.[mode]
      if (candidates && candidates.size > 0) {
        // Pick the first available candidate (excluding self)
        for (const candidateId of candidates) {
          if (candidateId === socketId) continue
          
          // Found a match! Remove them from the global queue
          const idx = queue.findIndex(u => u.id === candidateId)
          if (idx !== -1) {
            const match = queue.splice(idx, 1)[0]
            removeFromInterestMap(match.id, mode, match.interests)
            return match
          }
        }
      }
    }
  }

  // 2. Fallback: Take the first person in queue who isn't us
  if (queue[0]?.id === socketId) {
    if (queue.length > 1) {
      const match = queue.splice(1, 1)[0]
      removeFromInterestMap(match.id, mode, match.interests)
      return match
    }
    return null
  }

  const match = queue.shift()
  removeFromInterestMap(match.id, mode, match.interests)
  return match
}

function removeFromQueue(socketId) {
  for (const mode of ['video', 'text']) {
    const idx = queues[mode].findIndex(u => u.id === socketId)
    if (idx !== -1) {
      const user = queues[mode].splice(idx, 1)[0]
      removeFromInterestMap(user.id, mode, user.interests)
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
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    // Keep connections alive — Railway closes idle WS after ~60s without traffic
    pingTimeout: 60000,
    pingInterval: 25000,
    // Try WebSocket first, fall back to polling
    transports: ['websocket', 'polling'],
    // Allow large signal payloads (some WebRTC offers can be big)
    maxHttpBufferSize: 1e7,
  })

  // ─── Socket Events ──────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    const clientCount = io.engine.clientsCount
    if (dev) console.log(`[+] ${socket.id} connected | total: ${clientCount}`)

    // ── Join Queue ────────────────────────────────────────────────────────────
    socket.on('join-queue', ({ mode = 'video', interests = [] } = {}) => {
      const queueKey = mode === 'text' ? 'text' : 'video'
      const queue = queues[queueKey]

      // Clean up previous room if any
      if (socketRoom.get(socket.id)) {
        leaveRoom(io, socket)
      }

      // Normalize interests
      const normalizedInterests = (Array.isArray(interests) ? interests : [])
        .map(i => String(i).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 10)

      const match = findMatch(queueKey, socket.id, normalizedInterests)

      if (match) {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`
        rooms.set(roomId, { members: new Set([socket.id, match.id]) })
        socketRoom.set(socket.id, roomId)
        socketRoom.set(match.id, roomId)

        socket.join(roomId)
        io.sockets.sockets.get(match.id)?.join(roomId)

        socket.emit('matched', { roomId, initiator: true })
        io.to(match.id).emit('matched', { roomId, initiator: false })
      } else {
        // Avoid duplicates in queue
        if (!queue.find(u => u.id === socket.id)) {
          queue.push({ id: socket.id, interests: normalizedInterests })
          addToInterestMap(socket.id, queueKey, normalizedInterests)
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
      if (dev) console.log(`[-] ${socket.id} disconnected (${reason}) | total: ${io.engine.clientsCount}`)
    })
  })

  // ─── Periodic Stats Broadcast ─────────────────────────────────────────────
  // Broadcasts online count every 30s — keeps connections warm on Railway
  // and gives all clients a live user count update without them asking.
  setInterval(() => {
    const waitingCount = queues.video.length + queues.text.length
    io.emit('stats', {
      online: io.engine.clientsCount,
      waiting: waitingCount,
      chatting: rooms.size * 2,
      rooms: rooms.size,
    })
    if (dev) {
      console.log(
        `[stats] online=${io.engine.clientsCount} | rooms=${rooms.size} | ` +
        `queue_video=${queues.video.length} | queue_text=${queues.text.length}`
      )
    }
  }, 30_000)

  // ─── Start ─────────────────────────────────────────────────────────────────
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Mode: ${dev ? 'development' : 'production'}`)
  })
})
