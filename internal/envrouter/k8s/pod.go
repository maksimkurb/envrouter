package k8s

import (
	"context"
	"gitlab.com/jonasasx/envrouter/internal/utils"
	"k8s.io/api/core/v1"
	"k8s.io/client-go/tools/cache"
)

type PodService interface {
	GetAll() []*v1.Pod
}

type podService struct {
	ctx    context.Context
	client *client
	stores []cache.Store
}

func NewPodService(
	ctx context.Context,
	client *client,
	observer utils.Observer,
	namespaces []string,
) (PodService, chan struct{}) {
	clientset, _, err := client.getK8sClient()
	if err != nil {
		panic(err)
	}
	stores, stop := startInformers(
		clientset.CoreV1().RESTClient(),
		"pods",
		namespaces,
		&v1.Pod{},
		cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				observer.Publish(nil, obj.(*v1.Pod))
			},
			UpdateFunc: func(oldObj interface{}, newObj interface{}) {
				observer.Publish(oldObj.(*v1.Pod), newObj.(*v1.Pod))
			},
			DeleteFunc: func(obj interface{}) {
				observer.Publish(obj.(*v1.Pod), nil)
			},
		},
	)
	return &podService{
		ctx,
		client,
		stores,
	}, stop
}

func (p *podService) GetAll() []*v1.Pod {
	var result []*v1.Pod
	for _, store := range p.stores {
		for _, pod := range store.List() {
			result = append(result, pod.(*v1.Pod))
		}
	}
	return result
}
