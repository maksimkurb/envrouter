import {Application, Environment, Instance, InstancePod, Ref, RefBinding} from "../axios";

// First event on /api/v2/subscription: the complete dashboard state in one
// message; incremental SSEvent deltas follow on the same ordered stream.
export interface Snapshot {
    environments: Environment[]
    applications: Application[]
    refBindings: RefBinding[]
    instances: Instance[]
    instancePods: InstancePod[]
    refsHeads: Ref[]
}

export interface SSEvent {
    itemType: "Ping" | "Instance" | "InstancePod" | "RefHead" | "RefBinding" | "Snapshot"
    item: Instance | InstancePod | Ref | RefBinding | Snapshot,
    event: "UPDATED" | "DELETED"
}
