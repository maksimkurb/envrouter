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
import { Loader2 } from 'lucide-react'
import { RefSwitchTable, type RefSwitch } from './RefSwitchTable'

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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Branch switch history — {applicationName} · {environmentName}
          </DialogTitle>
          <DialogDescription>
            Who changed the target branch, from where. Last 50 changes, up to 30 days; kept in
            memory until the EnvRouter server restarts.
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
            <RefSwitchTable records={records} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
