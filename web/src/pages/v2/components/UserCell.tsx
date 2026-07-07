import { useState } from 'react'
import { initialsOf, useGravatar } from '@/lib/gravatar'
import { cn } from '@/lib/utils'

interface UserCellProps {
  fullName: string
  userIdentifier: string
  email: string
}

// Gravatar with initials fallback, same behavior as the sidebar user card.
export function UserAvatar({
  name,
  email,
  className,
}: {
  name: string
  email: string
  className?: string
}) {
  const avatar = useGravatar(email, 64)
  const [imgFailed, setImgFailed] = useState(false)
  return avatar && !imgFailed ? (
    <img
      src={avatar}
      alt=""
      onError={() => setImgFailed(true)}
      className={cn('size-7 shrink-0 rounded-full bg-muted object-cover', className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold leading-none text-primary',
        className
      )}
    >
      {initialsOf(name || email)}
    </span>
  )
}

// Avatar + full name with the email (or identifier fallback) below in gray.
export function UserCell({ fullName, userIdentifier, email }: UserCellProps) {
  const displayName = fullName || userIdentifier
  if (!displayName && !email) {
    return <span className="text-muted-foreground">anonymous</span>
  }
  // Always surface a second identity line: the email when present, otherwise
  // the user identifier when it isn't already the displayed name.
  const secondary = email || (userIdentifier !== displayName ? userIdentifier : '')
  return (
    <span className="inline-flex items-center gap-2">
      <UserAvatar name={displayName} email={email} />
      <span className="grid min-w-0 text-left leading-tight">
        <span className="truncate font-medium">{displayName || '—'}</span>
        <span className="truncate text-xs text-muted-foreground" title={secondary}>
          {secondary || '—'}
        </span>
      </span>
    </span>
  )
}
