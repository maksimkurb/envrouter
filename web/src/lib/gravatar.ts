import { useEffect, useState } from 'react'

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
// initials. Returns undefined until the async hash resolves (or no email).
export function useGravatar(email: string | undefined, size = 64): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const normalized = email?.trim().toLowerCase()
    if (!normalized) {
      setUrl(undefined)
      return
    }
    let cancelled = false
    sha256Hex(normalized)
      .then((hash) => {
        if (!cancelled) setUrl(`https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`)
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [email, size])
  return url
}
