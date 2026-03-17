// pages/api/ice-servers.ts
// Server-side endpoint that fetches TURN credentials from Metered.
// This runs on the server so the API key stays secret and works at runtime (no build-time baking).

import type { NextApiRequest, NextApiResponse } from 'next'

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Cache for 1 hour — credentials are valid much longer so this is fine
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')

  const apiKey = process.env.METERED_API_KEY  // Server-side only (no NEXT_PUBLIC_ prefix)

  if (!apiKey) {
    console.warn('[ice-servers] No METERED_API_KEY set, returning STUN fallback')
    return res.status(200).json(FALLBACK_ICE_SERVERS)
  }

  try {
    const response = await fetch(
      `https://omegleyassine.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { next: { revalidate: 3600 } } as any
    )

    if (!response.ok) throw new Error(`Metered API returned ${response.status}`)

    const iceServers = await response.json()
    return res.status(200).json(iceServers)
  } catch (err) {
    console.error('[ice-servers] Failed to fetch from Metered:', err)
    // Always return something usable — don't fail the chat entirely
    return res.status(200).json(FALLBACK_ICE_SERVERS)
  }
}
