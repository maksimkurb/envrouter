import { Instance, InstancePod, Ref, RefBinding } from '@/axios'

/**
 * Check if a git ref exists in the list of repository refs
 */
export function refExists(ref: string, refsHeads: Ref[]): boolean {
  return refsHeads.some((r) => r.ref === ref)
}

/**
 * Filter instance pods by their parent instance
 */
export function filterPodsByInstance(
  instancePods: InstancePod[],
  instance: Instance
): InstancePod[] {
  return instancePods.filter(
    (pod) => pod.parents?.includes(`${instance.type}/${instance.name}`) || false
  )
}

/**
 * Check if an instance is currently deploying
 */
export function isInstanceDeploying(
  refBinding: RefBinding | undefined,
  refsHeads: Ref[],
  instancePods: InstancePod[]
): boolean {
  if (!refBinding?.ref) return false

  const targetCommit = refsHeads.find((r) => r.ref === refBinding.ref)?.commit
  if (!targetCommit?.sha) return false

  return !instancePods.every((pod) => pod.commitSha === targetCommit.sha)
}

/**
 * Get the target commit for a ref binding
 */
export function getTargetCommit(
  refBinding: RefBinding | undefined,
  refsHeads: Ref[]
): Ref['commit'] | undefined {
  if (!refBinding?.ref) return undefined
  return refsHeads.find((r) => r.ref === refBinding.ref)?.commit
}
