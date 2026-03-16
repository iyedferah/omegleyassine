import { io, type Socket } from 'socket.io-client'

// Singleton — one socket connection per browser tab.
// Re-using the same instance across pages prevents duplicate connections.
let _socket: Socket | null = null

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() must only be called on the client')
  }

  if (!_socket) {
    _socket = io({
      // Connect to same origin (Next.js custom server handles /socket.io)
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Reconnect automatically on network blips
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    _socket.on('connect_error', (err) => {
      console.error('[socket] Connection error:', err.message)
    })
  }

  return _socket
}
