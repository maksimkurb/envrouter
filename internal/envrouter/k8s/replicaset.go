package k8s

import (
	"context"
	"k8s.io/api/apps/v1"
	"k8s.io/client-go/tools/cache"
)

type ReplicaSetService interface {
	Get(namespace string, name string) (*v1.ReplicaSet, error)
}

type replicaSetService struct {
	ctx    context.Context
	client *client
	stores []cache.Store
}

func NewReplicaSetService(
	ctx context.Context,
	client *client,
	namespaces []string,
) (ReplicaSetService, chan struct{}) {
	clientset, _, err := client.getK8sClient()
	if err != nil {
		panic(err)
	}
	stores, stop := startInformers(
		clientset.AppsV1().RESTClient(),
		"replicasets",
		namespaces,
		&v1.ReplicaSet{},
		cache.ResourceEventHandlerFuncs{},
	)
	return &replicaSetService{
		ctx,
		client,
		stores,
	}, stop
}

func (d *replicaSetService) Get(namespace string, name string) (*v1.ReplicaSet, error) {
	key := namespace + "/" + name
	for _, store := range d.stores {
		replicaSet, exists, err := store.GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exists {
			return replicaSet.(*v1.ReplicaSet), nil
		}
	}
	return nil, nil
}
