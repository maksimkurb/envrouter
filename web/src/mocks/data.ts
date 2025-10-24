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
} from '../axios/api'

// Environments
export const mockEnvironments: Environment[] = [
  { name: 'dev' },
  { name: 'qa' },
  { name: 'staging' },
  { name: 'prod' },
]

// Repositories
export const mockRepositories: Repository[] = [
  {
    name: 'frontend-app',
    url: 'https://github.com/company/frontend-app.git',
    credentialsSecret: 'github-creds',
  },
  {
    name: 'backend-api',
    url: 'https://github.com/company/backend-api.git',
    credentialsSecret: 'github-creds',
  },
  {
    name: 'auth-service',
    url: 'https://github.com/company/auth-service.git',
    credentialsSecret: 'github-creds',
  },
]

// Applications
export const mockApplications: Application[] = [
  {
    name: 'frontend',
    repositoryName: 'frontend-app',
    webhook: 'https://ci.company.com/webhook/frontend',
  },
  {
    name: 'backend',
    repositoryName: 'backend-api',
    webhook: 'https://ci.company.com/webhook/backend',
  },
  {
    name: 'auth',
    repositoryName: 'auth-service',
    webhook: 'https://ci.company.com/webhook/auth',
  },
  {
    name: 'notifier',
    repositoryName: 'backend-api',
    webhook: 'https://ci.company.com/webhook/notifier',
  },
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

// Git Refs
export const mockRefs: Ref[] = [
  {
    ref: 'main',
    repository: 'frontend-app',
    commit: mockCommits.main,
  },
  {
    ref: 'develop',
    repository: 'frontend-app',
    commit: mockCommits.develop,
  },
  {
    ref: 'feature/user-profile',
    repository: 'frontend-app',
    commit: mockCommits.feature1,
  },
  {
    ref: 'main',
    repository: 'backend-api',
    commit: mockCommits.main,
  },
  {
    ref: 'develop',
    repository: 'backend-api',
    commit: mockCommits.develop,
  },
  {
    ref: 'hotfix/security',
    repository: 'backend-api',
    commit: mockCommits.hotfix,
  },
  {
    ref: 'main',
    repository: 'auth-service',
    commit: mockCommits.main,
  },
  {
    ref: 'develop',
    repository: 'auth-service',
    commit: mockCommits.develop,
  },
]

// RefBindings - what should be deployed where
export const mockRefBindings: RefBinding[] = [
  // Dev environment
  { environment: 'dev', application: 'frontend', ref: 'develop' },
  { environment: 'dev', application: 'backend', ref: 'develop' },
  { environment: 'dev', application: 'auth', ref: 'develop' },
  { environment: 'dev', application: 'notifier', ref: 'feature/user-profile' },

  // QA environment
  { environment: 'qa', application: 'frontend', ref: 'feature/user-profile' },
  { environment: 'qa', application: 'backend', ref: 'develop' },
  { environment: 'qa', application: 'auth', ref: 'main' },
  { environment: 'qa', application: 'notifier', ref: 'develop' },

  // Staging environment
  { environment: 'staging', application: 'frontend', ref: 'main' },
  { environment: 'staging', application: 'backend', ref: 'hotfix/security' },
  { environment: 'staging', application: 'auth', ref: 'main' },

  // Prod environment
  { environment: 'prod', application: 'frontend', ref: 'main' },
  { environment: 'prod', application: 'backend', ref: 'main' },
  { environment: 'prod', application: 'auth', ref: 'main' },
]

// Instances - actual deployments
export const mockInstances: Instance[] = [
  // Dev
  {
    type: 'deployment' as const,
    name: 'frontend-dev',
    environment: 'dev',
    application: 'frontend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
  },
  {
    type: 'deployment' as const,
    name: 'backend-dev',
    environment: 'dev',
    application: 'backend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
  },
  {
    type: 'deployment' as const,
    name: 'auth-dev',
    environment: 'dev',
    application: 'auth',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
  },
  {
    type: 'deployment' as const,
    name: 'notifier-dev',
    environment: 'dev',
    application: 'notifier',
    ref: 'feature/user-profile',
    commitSha: mockCommits.feature1.sha,
  },

  // QA
  {
    type: 'deployment' as const,
    name: 'frontend-qa',
    environment: 'qa',
    application: 'frontend',
    ref: 'feature/user-profile',
    commitSha: mockCommits.feature1.sha,
  },
  {
    type: 'deployment' as const,
    name: 'backend-qa',
    environment: 'qa',
    application: 'backend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
  },
  {
    type: 'deployment' as const,
    name: 'auth-qa',
    environment: 'qa',
    application: 'auth',
    ref: 'main',
    commitSha: mockCommits.main.sha,
  },

  // Staging
  {
    type: 'deployment' as const,
    name: 'frontend-staging',
    environment: 'staging',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
  },
  {
    type: 'deployment' as const,
    name: 'backend-staging',
    environment: 'staging',
    application: 'backend',
    ref: 'hotfix/security',
    commitSha: mockCommits.hotfix.sha,
  },

  // Prod
  {
    type: 'deployment' as const,
    name: 'frontend-prod',
    environment: 'prod',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
  },
  {
    type: 'deployment' as const,
    name: 'backend-prod',
    environment: 'prod',
    application: 'backend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
  },
  {
    type: 'deployment' as const,
    name: 'auth-prod',
    environment: 'prod',
    application: 'auth',
    ref: 'main',
    commitSha: mockCommits.main.sha,
  },
]

// InstancePods - individual pods with different statuses
export const mockInstancePods: InstancePod[] = [
  // Frontend Dev - multiple pods, all running
  {
    name: 'frontend-dev-7d8f9c-abc12',
    environment: 'dev',
    application: 'frontend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-15T08:00:00Z',
    startedTime: '2025-01-15T08:01:30Z',
    started: true,
    parents: [],
  },
  {
    name: 'frontend-dev-7d8f9c-def34',
    environment: 'dev',
    application: 'frontend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-15T08:00:05Z',
    startedTime: '2025-01-15T08:01:35Z',
    started: true,
    parents: [],
  },

  // Backend Dev - one pod running
  {
    name: 'backend-dev-5a6b7c-xyz89',
    environment: 'dev',
    application: 'backend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-15T08:05:00Z',
    startedTime: '2025-01-15T08:06:20Z',
    started: true,
    parents: [],
  },

  // Auth Dev - pod with issues (not ready)
  {
    name: 'auth-dev-3e4f5g-mnp56',
    environment: 'dev',
    application: 'auth',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: false,
    phase: 'Running',
    createdTime: '2025-01-15T08:10:00Z',
    startedTime: '2025-01-15T08:11:15Z',
    started: true,
    parents: [],
  },

  // Notifier Dev - pending pod
  {
    name: 'notifier-dev-9h8i7j-qrs78',
    environment: 'dev',
    application: 'notifier',
    ref: 'feature/user-profile',
    commitSha: mockCommits.feature1.sha,
    ready: false,
    phase: 'Pending',
    createdTime: '2025-01-16T10:00:00Z',
    started: false,
    parents: [],
  },

  // QA Pods
  {
    name: 'frontend-qa-1a2b3c-uvw90',
    environment: 'qa',
    application: 'frontend',
    ref: 'feature/user-profile',
    commitSha: mockCommits.feature1.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-14T12:00:00Z',
    startedTime: '2025-01-14T12:02:00Z',
    started: true,
    parents: [],
  },
  {
    name: 'backend-qa-4d5e6f-jkl23',
    environment: 'qa',
    application: 'backend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-14T12:05:00Z',
    startedTime: '2025-01-14T12:06:30Z',
    started: true,
    parents: [],
  },

  // Staging Pods
  {
    name: 'frontend-staging-7g8h9i-mno45',
    environment: 'staging',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-13T14:00:00Z',
    startedTime: '2025-01-13T14:02:15Z',
    started: true,
    parents: [],
  },
  {
    name: 'backend-staging-0a1b2c-pqr67',
    environment: 'staging',
    application: 'backend',
    ref: 'hotfix/security',
    commitSha: mockCommits.hotfix.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-16T15:00:00Z',
    startedTime: '2025-01-16T15:01:45Z',
    started: true,
    parents: [],
  },

  // Prod Pods - multiple replicas
  {
    name: 'frontend-prod-3d4e5f-stu89',
    environment: 'prod',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:00:00Z',
    startedTime: '2025-01-10T10:02:30Z',
    started: true,
    parents: [],
  },
  {
    name: 'frontend-prod-3d4e5f-vwx01',
    environment: 'prod',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:00:02Z',
    startedTime: '2025-01-10T10:02:32Z',
    started: true,
    parents: [],
  },
  {
    name: 'frontend-prod-3d4e5f-yza23',
    environment: 'prod',
    application: 'frontend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:00:04Z',
    startedTime: '2025-01-10T10:02:34Z',
    started: true,
    parents: [],
  },
  {
    name: 'backend-prod-6g7h8i-bcd45',
    environment: 'prod',
    application: 'backend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:05:00Z',
    startedTime: '2025-01-10T10:06:45Z',
    started: true,
    parents: [],
  },
  {
    name: 'backend-prod-6g7h8i-efg67',
    environment: 'prod',
    application: 'backend',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:05:02Z',
    startedTime: '2025-01-10T10:06:47Z',
    started: true,
    parents: [],
  },
  {
    name: 'auth-prod-9j0k1l-hij89',
    environment: 'prod',
    application: 'auth',
    ref: 'main',
    commitSha: mockCommits.main.sha,
    ready: true,
    phase: 'Running',
    createdTime: '2025-01-10T10:10:00Z',
    startedTime: '2025-01-10T10:11:30Z',
    started: true,
    parents: [],
  },
]

// Credentials Secrets
export const mockCredentialsSecrets: CredentialsSecretListItem[] = [
  { name: 'github-creds', type: 'basic-auth' },
  { name: 'gitlab-token', type: 'token' },
  { name: 'bitbucket-ssh', type: 'ssh-key' },
]
