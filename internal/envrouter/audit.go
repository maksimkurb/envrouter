package envrouter

import (
	"sync"
	"time"
)

// RefSwitch records one branch change for a service in an environment.
type RefSwitch struct {
	Time           time.Time `json:"time"`
	Environment    string    `json:"environment"`
	Application    string    `json:"application"`
	OldRef         string    `json:"oldRef"`
	NewRef         string    `json:"newRef"`
	UserIdentifier string    `json:"userIdentifier"`
	FullName       string    `json:"fullName"`
	Email          string    `json:"email"`
	IP             string    `json:"ip"`
}

type AuditLog interface {
	Record(s RefSwitch)
	Find(environment string, application string) []RefSwitch
}

// ponytail: in-memory by design — the requirement is "until reboot"; the
// per-key cap keeps it bounded. Persist to a ConfigMap if that ever changes.
const auditCapPerKey = 100

type auditLog struct {
	mu       sync.RWMutex
	switches map[string][]RefSwitch
}

func NewAuditLog() AuditLog {
	return &auditLog{switches: map[string][]RefSwitch{}}
}

func (a *auditLog) Record(s RefSwitch) {
	key := s.Environment + "-" + s.Application
	a.mu.Lock()
	defer a.mu.Unlock()
	list := append([]RefSwitch{s}, a.switches[key]...) // newest first
	if len(list) > auditCapPerKey {
		list = list[:auditCapPerKey]
	}
	a.switches[key] = list
}

func (a *auditLog) Find(environment string, application string) []RefSwitch {
	a.mu.RLock()
	defer a.mu.RUnlock()
	list := a.switches[environment+"-"+application]
	result := make([]RefSwitch, len(list))
	copy(result, list)
	return result
}
