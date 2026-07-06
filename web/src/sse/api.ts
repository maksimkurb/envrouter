import {Instance, InstancePod, Ref, RefBinding} from "../axios";

export interface SSEvent {
    itemType: "Ping" | "Instance" | "InstancePod" | "RefHead" | "RefBinding"
    item: Instance | InstancePod | Ref | RefBinding,
    event: "UPDATED" | "DELETED"
}
