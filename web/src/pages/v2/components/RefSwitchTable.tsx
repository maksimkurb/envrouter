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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          {showScope && <TableHead>Environment</TableHead>}
          {showScope && <TableHead>Service</TableHead>}
          <TableHead>Change</TableHead>
          <TableHead>User</TableHead>
          {showIp && <TableHead>IP</TableHead>}
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
              {showScope && <TableCell className="text-xs">{record.environment}</TableCell>}
              {showScope && <TableCell className="text-xs">{record.application}</TableCell>}
              <TableCell className="font-mono text-xs">
                <span className="inline-flex items-center gap-1.5">
                  {record.oldRef || '—'}
                  <MoveRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  {record.newRef}
                </span>
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
