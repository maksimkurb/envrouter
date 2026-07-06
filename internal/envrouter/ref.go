package envrouter

import (
	"errors"
	"sort"
	"time"

	"github.com/ghodss/yaml"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/api"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/auth"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/k8s"
	"gitlab.com/jonasasx/envrouter/internal/utils"
)

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
		dataStorage,
		environmentService,
		applicationService,
		deployService,
		eventsObserver,
		auditLog,
	}
}

func (r *refService) SaveBinding(refBinding *api.RefBinding, actor auth.Actor) (*api.RefBinding, error) {
	if !r.environmentService.ExistsByName(refBinding.Environment) {
		return nil, errors.New("Environment " + refBinding.Environment + " is not found")
	}
	if !r.applicationService.ExistsByName(refBinding.Application) {
		return nil, errors.New("Application " + refBinding.Application + " is not found")
	}
	key := refBinding.Environment + "-" + refBinding.Application
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
		Item:     refBinding,
		Event:    "UPDATED",
	})
	err = r.deployService.Deploy(refBinding.Application, refBinding.Ref, DeployMeta{OldRef: oldRef, Actor: actor})
	return refBinding, err
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
