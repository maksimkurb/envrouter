package envrouter

import (
	"errors"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ghodss/yaml"
	log "github.com/sirupsen/logrus"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/api"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/auth"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/k8s"
	"gitlab.com/jonasasx/envrouter/internal/utils"
)

// refPattern allows only git-compatible ref characters (branch/tag names and
// commit SHAs). Prevents injection into the webhook trigger URL, where the ref
// is substituted raw ({ref}).
var refPattern = regexp.MustCompile(`^[A-Za-z0-9._/-]+$`)

// sanitizeRef trims and validates a ref against git's ref-name rules (the
// subset that matters here): allowed charset, no traversal, no leading/trailing
// slash, bounded length.
func sanitizeRef(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", errors.New("ref must not be empty")
	}
	if len(ref) > 255 {
		return "", errors.New("ref is too long")
	}
	if !refPattern.MatchString(ref) {
		return "", errors.New("ref contains invalid characters")
	}
	if strings.Contains(ref, "..") || strings.HasPrefix(ref, "/") || strings.HasSuffix(ref, "/") {
		return "", errors.New("ref has invalid format")
	}
	return ref, nil
}

type RefService interface {
	SaveBinding(refBinding *api.RefBinding, actor auth.Actor) (*api.RefBinding, error)
	FindAllBindings(environmentFilter *string, applicationFilter *string, refFilter *string) ([]*api.RefBinding, error)
	SnapshotBindings() ([]*api.RefBinding, error)
}

type refService struct {
	dataStorage        k8s.ConfigMapDataStorage
	environmentService EnvironmentService
	applicationService ApplicationService
	deployService      DeployService
	eventsObserver     utils.Observer
	auditLog           AuditLog
	// keyLocks serializes SaveBinding per env-app so the read-oldRef →
	// save → audit sequence is atomic and the audit log can't record a stale
	// oldRef under concurrent switches.
	locksMu  sync.Mutex
	keyLocks map[string]*sync.Mutex
}

func NewRefService(
	dataStorage k8s.ConfigMapDataStorage,
	environmentService EnvironmentService,
	applicationService ApplicationService,
	deployService DeployService,
	eventsObserver utils.Observer,
	auditLog AuditLog,
) RefService {
	return &refService{
		dataStorage:        dataStorage,
		environmentService: environmentService,
		applicationService: applicationService,
		deployService:      deployService,
		eventsObserver:     eventsObserver,
		auditLog:           auditLog,
		keyLocks:           map[string]*sync.Mutex{},
	}
}

// lockKey returns the per-key mutex, locked, plus its unlock func. Deadlock-free
// by construction: locksMu is released before the keyed mutex is taken, and a
// caller only ever holds one keyed mutex at a time (no nested locking).
func (r *refService) lockKey(key string) func() {
	r.locksMu.Lock()
	l, ok := r.keyLocks[key]
	if !ok {
		l = &sync.Mutex{}
		r.keyLocks[key] = l
	}
	r.locksMu.Unlock()
	l.Lock()
	return l.Unlock
}

func (r *refService) SaveBinding(refBinding *api.RefBinding, actor auth.Actor) (*api.RefBinding, error) {
	ref, err := sanitizeRef(refBinding.Ref)
	if err != nil {
		return nil, err
	}
	refBinding.Ref = ref
	if !r.environmentService.ExistsByName(refBinding.Environment) {
		return nil, errors.New("Environment " + refBinding.Environment + " is not found")
	}
	if !r.applicationService.ExistsByName(refBinding.Application) {
		return nil, errors.New("Application " + refBinding.Application + " is not found")
	}
	key := refBinding.Environment + "-" + refBinding.Application
	unlock := r.lockKey(key)
	defer unlock()
	// DefaultRef mirrors what FindAllBindings reports for unbound pairs
	oldRef := DefaultRef
	if existing, err := r.dataStorage.GetByKey(key); err == nil {
		item := api.RefBinding{}
		if yaml.Unmarshal([]byte(existing), &item) == nil && item.Ref != "" {
			oldRef = item.Ref
		}
	}
	value, err := yaml.Marshal(refBinding)
	if err != nil {
		return nil, err
	}
	err = r.dataStorage.Save(key, string(value))
	if err != nil {
		return nil, err
	}
	r.auditLog.Record(RefSwitch{
		Time:           time.Now(),
		Environment:    refBinding.Environment,
		Application:    refBinding.Application,
		OldRef:         oldRef,
		NewRef:         refBinding.Ref,
		UserIdentifier: actor.UserIdentifier,
		FullName:       actor.FullName,
		Email:          actor.Email,
		IP:             actor.IP,
	})
	// the binding is persisted at this point — tell every connected client,
	// even if the deploy webhook below fails
	r.eventsObserver.Publish(nil, api.SSEvent{
		ItemType: "RefBinding",
		Item: api.RefBindingUpdate{
			RefBinding: *refBinding,
			OldRef:     oldRef,
			UpdatedBy: api.RefBindingActor{
				UserIdentifier: actor.UserIdentifier,
				FullName:       actor.FullName,
				Email:          actor.Email,
			},
		},
		Event: "UPDATED",
	})
	// the binding is already persisted and announced over SSE — a webhook
	// failure must not fail the request, or clients see an error for a switch
	// that DID happen and revert their UI out of sync with the server
	if err := r.deployService.Deploy(refBinding.Application, refBinding.Ref, DeployMeta{OldRef: oldRef, Actor: actor}); err != nil {
		log.Errorf("deploy webhook for %s/%s (ref %s) failed: %v", refBinding.Environment, refBinding.Application, refBinding.Ref, err)
	}
	return refBinding, nil
}

// SnapshotBindings returns only the real stored bindings (sparse), with one
// ConfigMap GET and no env×app cross-product. The v2 snapshot uses this;
// unbound pairs are filled with Snapshot.DefaultRef on the client.
func (r *refService) SnapshotBindings() ([]*api.RefBinding, error) {
	data, err := r.dataStorage.GetAll()
	if err != nil {
		return nil, err
	}
	result := []*api.RefBinding{}
	for _, v := range data {
		item := api.RefBinding{}
		if err := yaml.Unmarshal([]byte(v), &item); err != nil {
			return nil, err
		}
		result = append(result, &item)
	}
	return result, nil
}

func (r *refService) FindAllBindings(environmentFilter *string, applicationFilter *string, refFilter *string) ([]*api.RefBinding, error) {
	data, err := r.dataStorage.GetAll()
	if err != nil {
		return nil, err
	}
	bindings := map[string]string{}
	for _, v := range data {
		item := api.RefBinding{}
		err := yaml.Unmarshal([]byte(v), &item)
		if err != nil {
			return nil, err
		}
		bindings[item.Environment+"-"+item.Application] = item.Ref
	}
	environments, err := r.environmentService.FindAll()
	if err != nil {
		return nil, err
	}
	applications, err := r.applicationService.FindAll()
	if err != nil {
		return nil, err
	}
	result := []*api.RefBinding{}
	for _, environment := range environments {
		if environmentFilter != nil && *environmentFilter != "" && *environmentFilter != environment.Name {
			continue
		}
		for _, application := range applications {
			if applicationFilter != nil && *applicationFilter != "" && *applicationFilter != application.Name {
				continue
			}
			var ref string
			if v, ok := bindings[environment.Name+"-"+application.Name]; ok {
				ref = v
			} else {
				ref = DefaultRef
			}
			if refFilter != nil && *refFilter != "" && *refFilter != ref {
				continue
			}
			item := api.RefBinding{
				Environment: environment.Name,
				Application: application.Name,
				Ref:         ref,
			}
			result = append(result, &item)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Environment != result[j].Environment {
			return result[i].Environment < result[j].Environment
		}
		return result[i].Application < result[j].Application
	})
	return result, nil
}
