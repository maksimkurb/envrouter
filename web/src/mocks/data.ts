import {
  Application,
  Environment,
  Repository,
  Ref,
  RefBinding,
  Instance,
  InstancePod,
  CredentialsSecretListItem,
  Commit,
  InstanceTypeEnum,
} from '../axios/api'

// Environments
export const mockEnvironments: Environment[] = [
  { name: 'dev1' },
  { name: 'dev2' },
  { name: 'dev3' },
  { name: 'dev4' },
  { name: 'dev5' },
  { name: 'qa1' },
  { name: 'qa2' },
  { name: 'qa3' },
  { name: 'qa4' },
  { name: 'qa5' },
  { name: 'staging1' },
  { name: 'staging2' },
  { name: 'staging3' },
  { name: 'staging4' },
  { name: 'staging5' },
  { name: 'prod1' },
  { name: 'prod2' },
  { name: 'prod3' },
  { name: 'prod4' },
  { name: 'prod5' },
]

// Repositories
export const mockRepositories: Repository[] = [
  { name: 'frontend-app', url: 'https://github.com/company/frontend-app.git', credentialsSecret: 'github-creds' },
  { name: 'backend-api', url: 'https://github.com/company/backend-api.git', credentialsSecret: 'github-creds' },
  { name: 'auth-service', url: 'https://github.com/company/auth-service.git', credentialsSecret: 'github-creds' },
  { name: 'payment-service', url: 'https://github.com/company/payment-service.git', credentialsSecret: 'github-creds' },
  { name: 'notification-service', url: 'https://github.com/company/notification-service.git', credentialsSecret: 'github-creds' },
  { name: 'user-service', url: 'https://github.com/company/user-service.git', credentialsSecret: 'github-creds' },
  { name: 'order-service', url: 'https://github.com/company/order-service.git', credentialsSecret: 'github-creds' },
  { name: 'inventory-service', url: 'https://github.com/company/inventory-service.git', credentialsSecret: 'github-creds' },
  { name: 'analytics-service', url: 'https://github.com/company/analytics-service.git', credentialsSecret: 'github-creds' },
  { name: 'search-service', url: 'https://github.com/company/search-service.git', credentialsSecret: 'github-creds' },
  { name: 'cdn-service', url: 'https://github.com/company/cdn-service.git', credentialsSecret: 'github-creds' },
  { name: 'logging-service', url: 'https://github.com/company/logging-service.git', credentialsSecret: 'github-creds' },
  { name: 'monitoring-service', url: 'https://github.com/company/monitoring-service.git', credentialsSecret: 'github-creds' },
  { name: 'admin-panel', url: 'https://github.com/company/admin-panel.git', credentialsSecret: 'github-creds' },
  { name: 'mobile-backend', url: 'https://github.com/company/mobile-backend.git', credentialsSecret: 'github-creds' },
]

// Applications
export const mockApplications: Application[] = [
  { name: 'frontend', repositoryName: 'frontend-app', webhook: 'https://ci.company.com/webhook/frontend' },
  { name: 'backend', repositoryName: 'backend-api', webhook: 'https://ci.company.com/webhook/backend' },
  { name: 'auth', repositoryName: 'auth-service', webhook: 'https://ci.company.com/webhook/auth' },
  { name: 'payment', repositoryName: 'payment-service', webhook: 'https://ci.company.com/webhook/payment' },
  { name: 'notification', repositoryName: 'notification-service', webhook: 'https://ci.company.com/webhook/notification' },
  { name: 'user', repositoryName: 'user-service', webhook: 'https://ci.company.com/webhook/user' },
  { name: 'order', repositoryName: 'order-service', webhook: 'https://ci.company.com/webhook/order' },
  { name: 'inventory', repositoryName: 'inventory-service', webhook: 'https://ci.company.com/webhook/inventory' },
  { name: 'analytics', repositoryName: 'analytics-service', webhook: 'https://ci.company.com/webhook/analytics' },
  { name: 'search', repositoryName: 'search-service', webhook: 'https://ci.company.com/webhook/search' },
  { name: 'cdn', repositoryName: 'cdn-service', webhook: 'https://ci.company.com/webhook/cdn' },
  { name: 'logging', repositoryName: 'logging-service', webhook: 'https://ci.company.com/webhook/logging' },
  { name: 'monitoring', repositoryName: 'monitoring-service', webhook: 'https://ci.company.com/webhook/monitoring' },
  { name: 'admin', repositoryName: 'admin-panel', webhook: 'https://ci.company.com/webhook/admin' },
  { name: 'mobile-api', repositoryName: 'mobile-backend', webhook: 'https://ci.company.com/webhook/mobile-api' },
]

// Commits
const mockCommits: Record<string, Commit> = {
  main: {
    sha: '87cf26c39505769e5fcf8133417f36e1883650f0',
    author: 'John Doe',
    message: 'feat: add new feature',
    timestamp: '2025-01-15T10:30:00Z',
  },
  develop: {
    sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
    author: 'Jane Smith',
    message: 'fix: resolve bug in authentication',
    timestamp: '2025-01-14T15:45:00Z',
  },
  feature1: {
    sha: 'f1e2d3c4b5a6978655443322110fedcba9876543',
    author: 'Alice Johnson',
    message: 'feat: implement user profile page',
    timestamp: '2025-01-13T09:20:00Z',
  },
  hotfix: {
    sha: '123456789abcdef0123456789abcdef012345678',
    author: 'Bob Williams',
    message: 'hotfix: critical security patch',
    timestamp: '2025-01-16T14:10:00Z',
  },
}

// Git Refs - generate refs for all repositories
const generateRefsForRepo = (repoName: string): Ref[] => [
  { ref: 'main', repository: repoName, commit: mockCommits.main },
  { ref: 'develop', repository: repoName, commit: mockCommits.develop },
  { ref: 'feature/user-profile', repository: repoName, commit: mockCommits.feature1 },
  { ref: 'hotfix/security', repository: repoName, commit: mockCommits.hotfix },
]

export const mockRefs: Ref[] = mockRepositories.flatMap((repo) => generateRefsForRepo(repo.name))

// RefBindings - generate bindings for all environments and applications
const refs = ['main', 'develop', 'feature/user-profile', 'hotfix/security']
export const mockRefBindings: RefBinding[] = mockEnvironments.flatMap((env) =>
  mockApplications.map((app, index) => ({
    environment: env.name,
    application: app.name,
    // Vary the refs: prod uses main, dev uses develop, qa/staging mix it up
    ref: env.name.startsWith('prod')
      ? 'main'
      : env.name.startsWith('dev')
      ? 'develop'
      : refs[index % refs.length],
  }))
)

// Instances - generate instances for all ref bindings
export const mockInstances: Instance[] = mockRefBindings.map((binding) => {
  const refCommit =
    binding.ref === 'main'
      ? mockCommits.main
      : binding.ref === 'develop'
      ? mockCommits.develop
      : binding.ref === 'feature/user-profile'
      ? mockCommits.feature1
      : mockCommits.hotfix

  return {
    type: InstanceTypeEnum.Deployment,
    name: `${binding.application}-${binding.environment}`,
    environment: binding.environment,
    application: binding.application,
    ref: binding.ref,
    commitSha: refCommit.sha,
  }
})

// InstancePods - generate pods for instances with varying statuses
const phases = ['Running', 'Running', 'Running', 'Running', 'Pending', 'Failed']
const generatePodsForInstance = (instance: Instance, podCount: number): InstancePod[] => {
  return Array.from({ length: podCount }, (_, i) => {
    const phase = phases[i % phases.length]
    const ready = phase === 'Running' && i % 5 !== 4 // Most running pods are ready
    const started = phase !== 'Pending'

    return {
      name: `${instance.name}-${Math.random().toString(36).substring(2, 8)}-${Math.random().toString(36).substring(2, 7)}`,
      environment: instance.environment,
      application: instance.application,
      ref: instance.ref,
      commitSha: instance.commitSha,
      ready,
      phase,
      createdTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      startedTime: started ? new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      started,
      parents: [`${instance.type}/${instance.name}`],
    }
  })
}

export const mockInstancePods: InstancePod[] = mockInstances.flatMap((instance) => {
  // Prod has 2-3 replicas, others have 1-2
  const podCount = instance.environment.startsWith('prod') ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 1
  return generatePodsForInstance(instance, podCount)
})

// Credentials Secrets
export const mockCredentialsSecrets: CredentialsSecretListItem[] = [
  { name: 'github-creds', type: 'basic-auth' },
  { name: 'gitlab-token', type: 'token' },
  { name: 'bitbucket-ssh', type: 'ssh-key' },
]
