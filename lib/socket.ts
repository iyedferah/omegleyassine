import { io, type Socket } from 'socket.io-client'

// Singleton — one socket connection per browser tab.
let _socket: Socket | null = null

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() must only be called on the client')
  }

  if (!_socket) {
    _socket = io({
      path: '/socket.io',
      // Always try WebSocket first, fall back to polling (works on all networks)
      transports: ['websocket', 'polling'],
      // Aggressive reconnection — Railway can restart on new deploy
      reconnection: true,
      reconnectionAttempts: Infinity,   // keep trying forever
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,       // back off max 5s between retries
      timeout: 20000,
      // Keep-alive: send a ping every 10s so Railway doesn't close the idle connection
      // (Railway's default idle timeout is ~5 minutes without traffic)
    })

    _socket.on('connect_error', (err) => {
      console.error('[socket] Connection error:', err.message)
    })

    _socket.on('reconnect', (attemptNumber) => {
      console.log(`[socket] Reconnected after ${attemptNumber} attempt(s)`)
    })

    _socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[socket] Reconnection attempt #${attemptNumber}`)
    })
  }

  return _socket
}

/** Force a new connection (use this if you want to reset the socket, e.g. after a hard error) */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
