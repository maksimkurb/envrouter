package k8s

import (
	"context"
	"gitlab.com/jonasasx/envrouter/internal/utils"
	"k8s.io/api/apps/v1"
	"k8s.io/client-go/tools/cache"
)

type DeploymentService interface {
	GetAll() []*v1.Deployment
	GetAllInNamespace(ns string) []*v1.Deployment
	GetAllByLabel(labelName string, labelValue string) []*v1.Deployment
}

type deploymentService struct {
	ctx    context.Context
	client *client
	stores []cache.Store
}

func NewDeploymentService(
	ctx context.Context,
	client *client,
	observer utils.Observer,
	namespaces []string,
) (DeploymentService, chan struct{}) {
	clientset, _, err := client.getK8sClient()
	if err != nil {
		panic(err)
	}
	stores, stop := startInformers(
		clientset.AppsV1().RESTClient(),
		"deployments",
		namespaces,
		&v1.Deployment{},
		cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				observer.Publish(nil, obj.(*v1.Deployment))
			},
			UpdateFunc: func(oldObj interface{}, newObj interface{}) {
				observer.Publish(oldObj.(*v1.Deployment), newObj.(*v1.Deployment))
			},
			DeleteFunc: func(obj interface{}) {
				observer.Publish(obj.(*v1.Deployment), nil)
			},
		},
	)
	return &deploymentService{
		ctx,
		client,
		stores,
	}, stop
}

func (d *deploymentService) GetAllInNamespace(ns string) []*v1.Deployment {
	var result []*v1.Deployment
	for _, store := range d.stores {
		for _, v := range store.List() {
			deployment := v.(*v1.Deployment)
			if ns == "" || ns == deployment.Namespace {
				result = append(result, deployment)
			}
		}
	}
	return result
}

func (d *deploymentService) GetAll() []*v1.Deployment {
	return d.GetAllInNamespace("")
}

func (d *deploymentService) GetAllByLabel(labelName string, labelValue string) []*v1.Deployment {
	var result []*v1.Deployment
	for _, store := range d.stores {
		for _, v := range store.List() {
			deployment := v.(*v1.Deployment)
			if val, ok := deployment.Labels[labelName]; ok && val == labelValue {
				result = append(result, deployment)
			}
		}
	}
	return result
}
