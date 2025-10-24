import { http, HttpResponse, delay } from 'msw'
import {
  mockEnvironments,
  mockApplications,
  mockRepositories,
  mockRefs,
  mockRefBindings,
  mockInstances,
  mockInstancePods,
  mockCredentialsSecrets,
} from './data'
import { RefBinding } from '../axios/api'

// Simulate network delay
const SIMULATED_DELAY = 300

export const handlers = [
  // GET /api/v1/environments
  http.get('/api/v1/environments', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockEnvironments)
  }),

  // GET /api/v1/applications
  http.get('/api/v1/applications', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockApplications)
  }),

  // PUT /api/v1/applications/:name
  http.put('/api/v1/applications/:name', async ({ params, request }) => {
    await delay(SIMULATED_DELAY)
    const { name } = params
    const updatedApp = await request.json()

    // Find and update the application
    const index = mockApplications.findIndex((app) => app.name === name)
    if (index !== -1) {
      mockApplications[index] = { ...mockApplications[index], ...updatedApp as any }
      return HttpResponse.json(mockApplications[index])
    }

    return HttpResponse.json({ error: 'Application not found' }, { status: 404 })
  }),

  // GET /api/v1/repositories
  http.get('/api/v1/repositories', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockRepositories)
  }),

  // POST /api/v1/repositories
  http.post('/api/v1/repositories', async ({ request }) => {
    await delay(SIMULATED_DELAY)
    const newRepo = await request.json()
    mockRepositories.push(newRepo as any)
    return HttpResponse.json(newRepo, { status: 201 })
  }),

  // DELETE /api/v1/repositories/:name
  http.delete('/api/v1/repositories/:name', async ({ params }) => {
    await delay(SIMULATED_DELAY)
    const { name } = params
    const index = mockRepositories.findIndex((repo) => repo.name === name)

    if (index !== -1) {
      mockRepositories.splice(index, 1)
      return new HttpResponse(null, { status: 204 })
    }

    return HttpResponse.json({ error: 'Repository not found' }, { status: 404 })
  }),

  // GET /api/v1/git/refs
  http.get('/api/v1/git/refs', async ({ request }) => {
    await delay(SIMULATED_DELAY)
    const url = new URL(request.url)
    const repository = url.searchParams.get('repository')

    if (repository) {
      const filtered = mockRefs.filter((ref) => ref.repository === repository)
      return HttpResponse.json(filtered)
    }

    return HttpResponse.json(mockRefs)
  }),

  // GET /api/v1/git/repositories/:repositoryName/commits/:sha
  http.get('/api/v1/git/repositories/:repositoryName/commits/:sha', async ({ params }) => {
    await delay(SIMULATED_DELAY)
    const { sha } = params

    // Find commit by SHA
    const ref = mockRefs.find((r) => r.commit.sha === sha)
    if (ref) {
      return HttpResponse.json(ref.commit)
    }

    return HttpResponse.json({ error: 'Commit not found' }, { status: 404 })
  }),

  // GET /api/v1/refBindings
  http.get('/api/v1/refBindings', async ({ request }) => {
    await delay(SIMULATED_DELAY)
    const url = new URL(request.url)
    const application = url.searchParams.get('application')
    const environment = url.searchParams.get('environment')
    const ref = url.searchParams.get('ref')

    let filtered = [...mockRefBindings]

    if (application) {
      filtered = filtered.filter((rb) => rb.application === application)
    }
    if (environment) {
      filtered = filtered.filter((rb) => rb.environment === environment)
    }
    if (ref) {
      filtered = filtered.filter((rb) => rb.ref === ref)
    }

    return HttpResponse.json(filtered)
  }),

  // POST /api/v1/refBindings
  http.post('/api/v1/refBindings', async ({ request }) => {
    await delay(SIMULATED_DELAY)
    const newBinding = (await request.json()) as RefBinding

    // Check if binding already exists
    const index = mockRefBindings.findIndex(
      (rb) =>
        rb.environment === newBinding.environment &&
        rb.application === newBinding.application
    )

    if (index !== -1) {
      // Update existing binding
      mockRefBindings[index] = newBinding
    } else {
      // Add new binding
      mockRefBindings.push(newBinding)
    }

    return HttpResponse.json(newBinding, { status: 201 })
  }),

  // GET /api/v1/instances
  http.get('/api/v1/instances', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockInstances)
  }),

  // GET /api/v1/instancePods
  http.get('/api/v1/instancePods', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockInstancePods)
  }),

  // GET /api/v1/credentialsSecrets
  http.get('/api/v1/credentialsSecrets', async () => {
    await delay(SIMULATED_DELAY)
    return HttpResponse.json(mockCredentialsSecrets)
  }),

  // POST /api/v1/credentialsSecrets
  http.post('/api/v1/credentialsSecrets', async ({ request }) => {
    await delay(SIMULATED_DELAY)
    const newSecret = await request.json()
    mockCredentialsSecrets.push(newSecret as any)
    return HttpResponse.json(newSecret, { status: 201 })
  }),

  // DELETE /api/v1/credentialsSecrets/:name
  http.delete('/api/v1/credentialsSecrets/:name', async ({ params }) => {
    await delay(SIMULATED_DELAY)
    const { name } = params
    const index = mockCredentialsSecrets.findIndex((secret) => secret.name === name)

    if (index !== -1) {
      mockCredentialsSecrets.splice(index, 1)
      return new HttpResponse(null, { status: 204 })
    }

    return HttpResponse.json({ error: 'Secret not found' }, { status: 404 })
  }),
]
