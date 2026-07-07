import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoveRight } from 'lucide-react'
import { parseGoTime, timeAgo } from '@/lib/time'
import { copyToClipboard } from '@/lib/clipboard'
import { useAuthContext } from '@/hooks/useAuth'
import { UserCell } from './UserCell'

export interface RefSwitch {
  time: string
  environment: string
  application: string
  oldRef: string
  newRef: string
  userIdentifier: string
  fullName: string
  email: string
  ip: string
}

interface RefSwitchTableProps {
  records: RefSwitch[]
  // adds Environment + Service columns for the global history page
  showScope?: boolean
}

export function RefSwitchTable({ records, showScope }: RefSwitchTableProps) {
  const auth = useAuthContext()
  // UI nicety only — the backend blanks IPs for non-admins anyway
  const showIp = auth?.canConfigure !== false
  return (
    // table-fixed so the Change column takes the flexible remainder and its
    // refs truncate responsively instead of forcing the page wider
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">When</TableHead>
          {showScope && <TableHead className="w-32">Environment</TableHead>}
          {showScope && <TableHead className="w-28">Service</TableHead>}
          <TableHead>Change</TableHead>
          <TableHead className="w-56">User</TableHead>
          {showIp && <TableHead className="w-20">IP</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, index) => {
          const time = parseGoTime(record.time)
          return (
            <TableRow key={`${record.time}-${index}`}>
              <TableCell
                className="whitespace-nowrap text-xs text-muted-foreground"
                title={time ? time.toLocaleString(undefined, { timeZoneName: 'short' }) : record.time}
              >
                {time ? timeAgo(time) : record.time}
              </TableCell>
              {showScope && (
                <TableCell className="truncate text-xs" title={record.environment}>
                  {record.environment}
                </TableCell>
              )}
              {showScope && (
                <TableCell className="truncate text-xs" title={record.application}>
                  {record.application}
                </TableCell>
              )}
              {/* two-line from → to, each truncating within the fixed column;
                  click a ref to copy it */}
              <TableCell className="font-mono text-xs">
                <div className="min-w-0 leading-tight">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(record.oldRef)}
                    title={`Copy ${record.oldRef}`}
                    disabled={!record.oldRef}
                    className="block w-full cursor-pointer truncate text-left text-muted-foreground/60 hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/60"
                  >
                    {record.oldRef || '—'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(record.newRef)}
                    title={`Copy ${record.newRef}`}
                    className="flex w-full min-w-0 cursor-pointer items-center gap-1 text-left hover:text-foreground"
                  >
                    <MoveRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{record.newRef}</span>
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                <UserCell
                  fullName={record.fullName}
                  userIdentifier={record.userIdentifier}
                  email={record.email}
                />
              </TableCell>
              {showIp && (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {record.ip || '—'}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
