import { useEffect, useState } from 'react'

// "Max Kurb" -> "MK"; single token -> first two letters.
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

// Jitsi's avatar palette + hashing, so initials-fallback colors match Jitsi's
// scheme (sum of the initials' code points, modulo palette length).
const AVATAR_COLORS = [
  '#6A50D3',
  '#FF9B42',
  '#DF486F',
  '#73348C',
  '#B23683',
  '#F96E57',
  '#4380E2',
  '#238561',
  '#00A8B3',
]

export function avatarColor(initials: string): string {
  let hash = 0
  for (const ch of initials) hash += ch.codePointAt(0) ?? 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Gravatar accepts a SHA-256 hex of the lowercased/trimmed email (modern API);
// SubtleCrypto avoids pulling in an MD5 dependency. `d=404` makes Gravatar
// return 404 when the user has no avatar, so the caller can fall back to
// initials; pass e.g. 'mp' where a built-in placeholder is wanted instead
// (browser notifications can't fall back).
export async function gravatarUrl(
  email: string | undefined,
  size = 64,
  fallback = '404'
): Promise<string | undefined> {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return undefined
  try {
    const hash = await sha256Hex(normalized)
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`
  } catch {
    return undefined
  }
}

// Returns undefined until the async hash resolves (or no email).
export function useGravatar(email: string | undefined, size = 64): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let cancelled = false
    gravatarUrl(email, size).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [email, size])
  return url
}
