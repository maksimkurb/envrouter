package api

type SSEvent struct {
	ItemType string      `json:"itemType"`
	Item     interface{} `json:"item"`
	Event    string      `json:"event"`
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
}
