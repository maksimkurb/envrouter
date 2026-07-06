import { useEffect, useState } from 'react'
import axios from 'axios'
import { BASE_PATH } from '@/axios/base'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, MoveRight } from 'lucide-react'
import { parseGoTime, timeAgo } from '@/lib/time'

interface RefSwitch {
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

interface RefSwitchLogDialogProps {
  environmentName: string
  applicationName: string
  onClose: () => void
}

export function RefSwitchLogDialog({
  environmentName,
  applicationName,
  onClose,
}: RefSwitchLogDialogProps) {
  const [records, setRecords] = useState<RefSwitch[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    axios
      .get<RefSwitch[]>(`${BASE_PATH}/api/v2/audit/refSwitches`, {
        params: { environment: environmentName, application: applicationName },
      })
      .then((response) => setRecords(response.data ?? []))
      .catch(() => setError(true))
  }, [environmentName, applicationName])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Branch switch history — {applicationName} · {environmentName}
          </DialogTitle>
          <DialogDescription>
            Who changed the target branch, from where. Kept in memory until the EnvRouter server
            restarts.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">
            Failed to load the switch history.
          </p>
        ) : records === null ? (
          <div className="flex justify-center py-6">
            <Loader2 aria-label="Loading history" className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No switches recorded since server start.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => {
                  const time = parseGoTime(record.time)
                  return (
                    <TableRow key={`${record.time}-${index}`}>
                      <TableCell
                        className="whitespace-nowrap text-xs text-muted-foreground"
                        title={time ? time.toLocaleString() : record.time}
                      >
                        {time ? timeAgo(time) : record.time}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {record.oldRef || '—'}
                          <MoveRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          {record.newRef}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-xs"
                        title={[record.fullName, record.email].filter(Boolean).join(' · ') || undefined}
                      >
                        {record.userIdentifier || (
                          <span className="text-muted-foreground">anonymous</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {record.ip || '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
