// backend sends Go's Time.String() format ("2026-07-06 10:12:34 +0000 UTC")
// in some fields and RFC3339 in others; handle both
export function parseGoTime(value?: string | null): Date | null {
  if (!value) return null
  const native = new Date(value)
  if (!isNaN(native.getTime())) return native
  const m = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{2})(\d{2})/)
  if (!m) return null
  const parsed = new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function timeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
