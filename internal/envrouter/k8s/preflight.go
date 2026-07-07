package k8s

import (
	"context"
	"fmt"
	"strings"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type resourceAccess struct {
	group    string
	resource string
	verbs    []string
}

// Resources the informers watch — verified in every configured namespace, or
// cluster-wide when the whitelist is empty.
var watchedResources = []resourceAccess{
	{"apps", "deployments", []string{"list", "watch"}},
	{"", "pods", []string{"list", "watch"}},
	{"apps", "replicasets", []string{"list", "watch"}},
}

// envrouter's own config/state (see dataStorageFactory), stored in its own
// namespace. Verbs mirror what the storage layer actually calls: ConfigMaps are
// get/create/update-only (a delete is a key removal via Update); Secrets are
// listed by label and deleted whole.
var configResources = []resourceAccess{
	{"", "configmaps", []string{"get", "create", "update"}},
	{"", "secrets", []string{"get", "list", "create", "update", "delete"}},
}

// CheckAccess fails fast at startup if the ServiceAccount lacks any permission
// envrouter needs. It uses SelfSubjectAccessReview (the "kubectl auth can-i"
// API), which every authenticated identity may call for itself — so the check
// needs no extra RBAC. Watched resources are verified per configured namespace
// (cluster-wide when namespaces is empty); config resources in envrouter's own
// namespace.
func (c *client) CheckAccess(namespaces []string) error {
	clientset, configNs, err := c.getK8sClient()
	if err != nil {
		return err
	}
	reviews := clientset.AuthorizationV1().SelfSubjectAccessReviews()
	runReview := func(ns, group, resource, verb string) (bool, error) {
		review := &authv1.SelfSubjectAccessReview{
			Spec: authv1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &authv1.ResourceAttributes{
					Namespace: ns,
					Verb:      verb,
					Group:     group,
					Resource:  resource,
				},
			},
		}
		resp, err := reviews.Create(context.TODO(), review, metav1.CreateOptions{})
		if err != nil {
			return false, err
		}
		return resp.Status.Allowed, nil
	}

	denied := collectDenied(runReview, namespaces, configNs)
	if len(denied) > 0 {
		return fmt.Errorf("missing %d RBAC permission(s):\n  - %s", len(denied), strings.Join(denied, "\n  - "))
	}
	return nil
}

// collectDenied is the pure preflight logic, split out so it can be tested
// without a live API server. runReview reports whether (verb, resource) is
// allowed in a namespace; it returns any error talking to the access-review
// API, which is itself treated as a denial.
func collectDenied(
	runReview func(ns, group, resource, verb string) (bool, error),
	namespaces []string,
	configNs string,
) []string {
	watchNs := namespaces
	if len(watchNs) == 0 {
		watchNs = []string{metav1.NamespaceAll} // "" — cluster-wide check
	}
	var denied []string
	check := func(ns string, r resourceAccess) {
		for _, verb := range r.verbs {
			allowed, err := runReview(ns, r.group, r.resource, verb)
			if err != nil {
				denied = append(denied, fmt.Sprintf("%s %s: access review failed: %v", verb, r.resource, err))
				continue
			}
			if !allowed {
				scope := "namespace " + ns
				if ns == metav1.NamespaceAll {
					scope = "cluster-wide"
				}
				denied = append(denied, fmt.Sprintf("%s %s (%s)", verb, r.resource, scope))
			}
		}
	}
	for _, ns := range watchNs {
		for _, r := range watchedResources {
			check(ns, r)
		}
	}
	for _, r := range configResources {
		check(configNs, r)
	}
	return denied
}
