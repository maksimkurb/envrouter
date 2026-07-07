package api

type SSEvent struct {
	ItemType string      `json:"itemType"`
	Item     interface{} `json:"item"`
	Event    string      `json:"event"`
}

// RefBindingActor identifies who switched a binding, for SSE deltas.
type RefBindingActor struct {
	UserIdentifier string `json:"userIdentifier"`
	FullName       string `json:"fullName"`
	Email          string `json:"email"`
}

// RefBindingUpdate is the RefBinding SSE delta payload: the new binding plus
// the previous ref, who changed it, and when. Also used in the snapshot's
// LastSwitches to show the latest change per binding on load. Snapshot
// bindings themselves stay plain RefBinding.
type RefBindingUpdate struct {
	RefBinding
	OldRef    string          `json:"oldRef"`
	UpdatedBy RefBindingActor `json:"updatedBy"`
	// Time is RFC3339; empty when unknown.
	Time string `json:"time,omitempty"`
}

// Snapshot is the first event on /api/v2/subscription: the complete dashboard
// state in one message, followed by incremental SSEvent deltas on the same
// ordered stream.
type Snapshot struct {
	Environments []*Environment `json:"environments"`
	Applications []*Application `json:"applications"`
	RefBindings  []*RefBinding  `json:"refBindings"`
	Instances    []*Instance    `json:"instances"`
	InstancePods []*InstancePod `json:"instancePods"`
	RefsHeads    []*Ref         `json:"refsHeads"`
	// DefaultRef is the ref shown for env×app pairs with no stored binding.
	DefaultRef string `json:"defaultRef"`
	// LastSwitches carries the most recent switch per env×app (from the audit
	// log) so the dashboard can show who last changed each binding, and when.
	LastSwitches []*RefBindingUpdate `json:"lastSwitches"`
}
