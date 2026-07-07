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
    defaultRef: string
}

// RefBinding deltas (not snapshot bindings) carry the previous ref and who
// switched it; absent on older backends.
export interface RefBindingUpdate extends RefBinding {
    oldRef?: string
    updatedBy?: {
        userIdentifier: string
        fullName: string
        email: string
    }
}

export interface SSEvent {
    itemType: "Ping" | "Instance" | "InstancePod" | "RefHead" | "RefBinding" | "Snapshot"
    item: Instance | InstancePod | Ref | RefBinding | RefBindingUpdate | Snapshot,
    event: "UPDATED" | "DELETED"
}
