package envrouter

import (
	"sort"
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
	FindAll() []RefSwitch
}

// ponytail: in-memory by design — the per-key cap and max age keep it bounded.
// Persist to a ConfigMap if history must survive restarts.
const auditCapPerKey = 50
const auditMaxAge = 30 * 24 * time.Hour

type auditLog struct {
	mu       sync.RWMutex
	switches map[string][]RefSwitch
}

func NewAuditLog() AuditLog {
	return &auditLog{switches: map[string][]RefSwitch{}}
}

// trimExpired cuts a newest-first list at the first entry older than auditMaxAge.
func trimExpired(list []RefSwitch, now time.Time) []RefSwitch {
	cutoff := now.Add(-auditMaxAge)
	for i, s := range list {
		if s.Time.Before(cutoff) {
			return list[:i]
		}
	}
	return list
}

func (a *auditLog) Record(s RefSwitch) {
	key := s.Environment + "-" + s.Application
	a.mu.Lock()
	defer a.mu.Unlock()
	list := append([]RefSwitch{s}, a.switches[key]...) // newest first
	// ponytail: purge on touch only — an untouched key holds ≤50 tiny structs
	list = trimExpired(list, time.Now())
	if len(list) > auditCapPerKey {
		list = list[:auditCapPerKey]
	}
	a.switches[key] = list
}

func (a *auditLog) Find(environment string, application string) []RefSwitch {
	a.mu.RLock()
	defer a.mu.RUnlock()
	list := trimExpired(a.switches[environment+"-"+application], time.Now())
	result := make([]RefSwitch, len(list))
	copy(result, list)
	return result
}

func (a *auditLog) FindAll() []RefSwitch {
	a.mu.RLock()
	defer a.mu.RUnlock()
	now := time.Now()
	result := []RefSwitch{}
	for _, list := range a.switches {
		result = append(result, trimExpired(list, now)...)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Time.After(result[j].Time) })
	return result
}
