import { useState } from 'react'
import { Application, DefaultApiFp, Repository } from '@/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Link as LinkIcon, KeyRound, Settings, Trash2, FolderGit2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRepositoriesData } from '@/hooks/useRepositoriesData'
import { RepositoryDialog } from './components/RepositoryDialog'
import { ApplicationDialog } from './components/ApplicationDialog'

const api = DefaultApiFp()

const NEW_REPOSITORY: Repository = { name: '', url: '', credentialsSecret: '', isNew: true }

function LoadingSkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading repositories"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border border-destructive/50 rounded-lg p-12 flex flex-col items-center justify-center gap-4"
    >
      <div className="text-center">
        <p className="text-lg font-medium">Failed to load repositories</p>
        <p className="text-sm text-muted-foreground">
          Check that the EnvRouter API is reachable and try again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

export default function RepositoriesPage() {
  const { toast } = useToast()
  const {
    repositories,
    applications,
    credentialsSecrets,
    addCredentialsSecret,
    loading,
    error,
    refetch,
  } = useRepositoriesData()

  const [editingRepository, setEditingRepository] = useState<Repository | null>(null)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Repository | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteRepository = (repository: Repository) => {
    setDeleting(true)
    api
      .apiV1RepositoriesNameDelete(repository.name)
      .then((request) => request())
      .then(() => {
        toast({ title: 'Repository deleted', description: repository.name })
        setDeleting(false)
        setDeleteTarget(null)
        refetch()
      })
      .catch(() => {
        setDeleting(false)
        toast({
          title: 'Failed to delete repository',
          description: repository.name,
          variant: 'destructive',
        })
      })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Repositories</h2>
          <p className="text-muted-foreground">
            Manage your Git repositories and credentials
          </p>
        </div>
        <Button onClick={() => setEditingRepository(NEW_REPOSITORY)}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add Repository
        </Button>
      </div>

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {repositories.length === 0 ? (
            <div className="border rounded-lg p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <FolderGit2 className="h-16 w-16" aria-hidden="true" />
              <div className="text-center">
                <p className="text-lg font-medium">No repositories yet</p>
                <p className="text-sm">Add a Git repository so its branches can be deployed.</p>
              </div>
              <Button variant="outline" onClick={() => setEditingRepository(NEW_REPOSITORY)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Add Repository
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repository) => (
                <Card key={repository.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg truncate" title={repository.name}>
                        {repository.name}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit repository ${repository.name}`}
                          onClick={() => setEditingRepository(repository)}
                        >
                          <Settings className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete repository ${repository.name}`}
                          onClick={() => setDeleteTarget(repository)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm min-w-0">
                        <LinkIcon className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
                        <span className="text-muted-foreground truncate" title={repository.url}>
                          {repository.url}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <KeyRound className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
                        {repository.credentialsSecret ? (
                          <Badge variant="outline">{repository.credentialsSecret}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No credentials</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <section className="space-y-3" aria-labelledby="applications-heading">
            <div>
              <h3 id="applications-heading" className="text-xl font-semibold tracking-tight">
                Applications
              </h3>
              <p className="text-sm text-muted-foreground">
                Detected from Kubernetes deployments — assign a repository and an optional CI
                webhook.
              </p>
            </div>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-6">
                No applications detected in the cluster.
              </p>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Repository</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((application) => (
                      <TableRow key={application.name}>
                        <TableCell>{application.name}</TableCell>
                        <TableCell>
                          {application.repositoryName || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={application.webhook}>
                          {application.webhook || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Configure application ${application.name}`}
                            onClick={() => setEditingApplication(application)}
                          >
                            <Settings className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}

      {editingRepository && (
        <RepositoryDialog
          repository={editingRepository}
          existingNames={repositories.map((r) => r.name)}
          credentialsSecrets={credentialsSecrets}
          onSecretCreated={addCredentialsSecret}
          onClose={(saved) => {
            setEditingRepository(null)
            if (saved) refetch()
          }}
        />
      )}

      {editingApplication && (
        <ApplicationDialog
          application={editingApplication}
          repositories={repositories}
          onClose={(saved) => {
            setEditingApplication(null)
            if (saved) refetch()
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repository?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.name}” from EnvRouter. Applications bound to it will no
              longer resolve branches or commits. The Git repository itself is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteRepository(deleteTarget)
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
