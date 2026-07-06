import { useState } from 'react'
import { Application, DefaultApiFp, Repository } from '@/axios'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const api = DefaultApiFp()

const NONE = '__none__'

interface ApplicationDialogProps {
  application: Application
  repositories: Repository[]
  onClose: (saved: boolean) => void
}

export function ApplicationDialog({ application, repositories, onClose }: ApplicationDialogProps) {
  const { toast } = useToast()
  const [repositoryName, setRepositoryName] = useState(application.repositoryName || NONE)
  const [webhook, setWebhook] = useState(application.webhook || '')
  const [saving, setSaving] = useState(false)

  const save = () => {
    setSaving(true)
    api
      .apiV1ApplicationsNamePut(application.name, {
        name: application.name,
        repositoryName: repositoryName === NONE ? '' : repositoryName,
        webhook: webhook.trim(),
      })
      .then((request) => request())
      .then(() => {
        toast({ title: 'Application updated', description: application.name })
        onClose(true)
      })
      .catch(() => {
        setSaving(false)
        toast({
          title: 'Failed to update application',
          description: application.name,
          variant: 'destructive',
        })
      })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {application.name}</DialogTitle>
          <DialogDescription>
            Applications are detected from Kubernetes deployment labels. Assign a repository to
            resolve branches and commits, and an optional CI webhook to trigger deployments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="app-repository">Repository</Label>
            <Select
              value={repositoryName}
              onValueChange={(value) => value && setRepositoryName(value)}
              disabled={saving}
              // display labels for SelectValue (otherwise the raw sentinel renders)
              items={[
                { value: NONE, label: 'None' },
                ...repositories.map((repository) => ({
                  value: repository.name,
                  label: repository.name,
                })),
              ]}
            >
              <SelectTrigger id="app-repository" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {repositories.map((repository) => (
                  <SelectItem key={repository.name} value={repository.name}>
                    {repository.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-webhook">Webhook URL</Label>
            <Input
              id="app-webhook"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              disabled={saving}
              placeholder="https://ci.example.com/hooks/deploy?branch={ref}"
              aria-describedby="app-webhook-hint"
            />
            <p id="app-webhook-hint" className="text-xs text-muted-foreground">
              Called with POST on every branch change. URL substitution:{' '}
              <code className="rounded bg-muted px-1 font-mono">{'{ref}'}</code> — the branch being
              deployed. The form body carries GitLab pipeline-trigger variables:{' '}
              <code className="rounded bg-muted px-1 font-mono">ENVROUTER_OLD_REF</code>,{' '}
              <code className="rounded bg-muted px-1 font-mono">ENVROUTER_NEW_REF</code>,{' '}
              <code className="rounded bg-muted px-1 font-mono">ENVROUTER_TRIGGERED_BY_USERNAME</code>,{' '}
              <code className="rounded bg-muted px-1 font-mono">ENVROUTER_TRIGGERED_BY_FULLNAME</code>,{' '}
              <code className="rounded bg-muted px-1 font-mono">ENVROUTER_TRIGGERED_BY_IP</code>.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
