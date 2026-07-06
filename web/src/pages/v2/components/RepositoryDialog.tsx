import { useState } from 'react'
import { CredentialsSecretListItem, DefaultApiFp, Repository } from '@/axios'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const api = DefaultApiFp()

// Radix/Base selects can't use '' as an item value; map "no credentials" through a sentinel
const NONE = '__none__'

interface RepositoryDialogProps {
  repository: Repository // isNew flag distinguishes create from edit
  existingNames: string[]
  credentialsSecrets: CredentialsSecretListItem[]
  onSecretCreated: (secret: CredentialsSecretListItem) => void
  onClose: (saved: boolean) => void
}

function NewSecretDialog({
  onClose,
}: {
  onClose: (created: CredentialsSecretListItem | null) => void
}) {
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  const save = () => {
    setSaving(true)
    api
      .apiV1CredentialsSecretsPost({ username, password, key })
      .then((request) => request())
      .then((response) => {
        toast({ title: 'Credentials secret created', description: response.data.name })
        onClose(response.data)
      })
      .catch(() => {
        setSaving(false)
        toast({ title: 'Failed to create credentials secret', variant: 'destructive' })
      })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New credentials secret</DialogTitle>
          <DialogDescription>
            Provide a username/password for HTTPS access, or a private key for SSH access. The
            secret is stored in the cluster.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="secret-username">Username</Label>
            <Input
              id="secret-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={saving}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secret-password">Password</Label>
            <Input
              id="secret-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secret-key">SSH private key</Label>
            <Textarea
              id="secret-key"
              rows={8}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(null)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create secret'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RepositoryDialog({
  repository,
  existingNames,
  credentialsSecrets,
  onSecretCreated,
  onClose,
}: RepositoryDialogProps) {
  const { toast } = useToast()
  const isNew = !!repository.isNew
  const [name, setName] = useState(repository.name)
  const [url, setUrl] = useState(repository.url)
  const [credentialsSecret, setCredentialsSecret] = useState(repository.credentialsSecret || NONE)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [creatingSecret, setCreatingSecret] = useState(false)

  const nameError = !submitted
    ? null
    : !name.trim()
      ? 'Name is required'
      : isNew && existingNames.includes(name.trim())
        ? 'A repository with this name already exists'
        : null
  const urlError = !submitted ? null : !url.trim() ? 'URL is required' : null

  const save = () => {
    setSubmitted(true)
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl || (isNew && existingNames.includes(trimmedName))) return
    setSaving(true)
    api
      .apiV1RepositoriesPost({
        name: trimmedName,
        url: trimmedUrl,
        credentialsSecret: credentialsSecret === NONE ? '' : credentialsSecret,
      })
      .then((request) => request())
      .then(() => {
        toast({
          title: isNew ? 'Repository added' : 'Repository updated',
          description: trimmedName,
        })
        onClose(true)
      })
      .catch((err) => {
        setSaving(false)
        toast({
          title:
            err?.response?.status === 403
              ? "You don't have permission to do that"
              : isNew
                ? 'Failed to add repository'
                : 'Failed to update repository',
          description: trimmedName,
          variant: 'destructive',
        })
      })
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !saving && onClose(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add repository' : `Edit ${repository.name}`}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Register a Git repository so its branches can be deployed.'
                : 'Update the repository URL or credentials.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {isNew && (
              <div className="grid gap-2">
                <Label htmlFor="repo-name">Name</Label>
                <Input
                  id="repo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'repo-name-error' : undefined}
                />
                {nameError && (
                  <p id="repo-name-error" role="alert" className="text-xs text-destructive">
                    {nameError}
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="repo-url">URL</Label>
              <Input
                id="repo-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={saving}
                placeholder="git@github.com:org/repo.git"
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'repo-url-error' : undefined}
              />
              {urlError && (
                <p id="repo-url-error" role="alert" className="text-xs text-destructive">
                  {urlError}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repo-secret">Credentials secret</Label>
              <Select
                value={credentialsSecret}
                onValueChange={(value) => value && setCredentialsSecret(value)}
                disabled={saving}
                // display labels for SelectValue (otherwise the raw sentinel renders)
                items={[
                  { value: NONE, label: 'None' },
                  ...credentialsSecrets.map((secret) => ({
                    value: secret.name,
                    label: `${secret.name} (${secret.type})`,
                  })),
                ]}
              >
                <SelectTrigger id="repo-secret" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {credentialsSecrets.map((secret) => (
                    <SelectItem key={secret.name} value={secret.name}>
                      {secret.name} ({secret.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => setCreatingSecret(true)}
                disabled={saving}
              >
                Create new credentials secret
              </Button>
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
      {creatingSecret && (
        <NewSecretDialog
          onClose={(created) => {
            setCreatingSecret(false)
            if (created) {
              onSecretCreated(created)
              setCredentialsSecret(created.name)
            }
          }}
        />
      )}
    </>
  )
}
