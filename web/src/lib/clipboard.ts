import { toast } from 'sonner'

// Shared copy-to-clipboard with a unified "Copied" toast.
export function copyToClipboard(value: string) {
  if (!value) return
  navigator.clipboard.writeText(value).then(
    () => toast.success('Copied to clipboard', { description: value }),
    () => {}
  )
}
