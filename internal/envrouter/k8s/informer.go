package k8s

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

// startInformers watches `resource` (filtered to envrouter-labelled objects)
// and returns one backing store per namespace plus a shared stop channel.
//
// An empty namespaces slice means cluster-wide (namespace ""), which needs a
// ClusterRole. A non-empty slice runs one informer per namespace, so envrouter
// can be granted a namespaced Role in each listed namespace instead — this is
// what makes RBAC whitelisting real.
func startInformers(
	restClient rest.Interface,
	resource string,
	namespaces []string,
	objType runtime.Object,
	handlers cache.ResourceEventHandlerFuncs,
) ([]cache.Store, chan struct{}) {
	if len(namespaces) == 0 {
		namespaces = []string{metav1.NamespaceAll} // "" — cluster-wide
	}
	optionsModifier := func(options *metav1.ListOptions) {
		options.LabelSelector = ApplicationLabelKey
	}
	stop := make(chan struct{})
	stores := make([]cache.Store, 0, len(namespaces))
	for _, ns := range namespaces {
		watchlist := cache.NewFilteredListWatchFromClient(restClient, resource, ns, optionsModifier)
		store, controller := cache.NewInformer(watchlist, objType, time.Minute*5, handlers)
		stores = append(stores, store)
		go controller.Run(stop)
	}
	return stores, stop
}
