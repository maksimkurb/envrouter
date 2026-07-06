package main

import (
	"context"
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"gitlab.com/jonasasx/envrouter/internal/envrouter"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/api"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/k8s"
	"gitlab.com/jonasasx/envrouter/internal/utils"
	"io"
	"net/http"
	"time"
)

func init() {
	log.Infof("Init")
}

func main() {
	log.SetFormatter(&log.JSONFormatter{})

	var err error
	client := k8s.NewClient("")
	eventsObserver := utils.NewObserver()

	dataStorageFactory := k8s.NewDataStorageFactory(client)

	repositoryService := envrouter.NewRepositoryService(dataStorageFactory.NewRepositoryStorage())

	credentialsSecretService := envrouter.NewCredentialsSecretService(dataStorageFactory.NewCredentialsSecretStorage())

	deploymentObserver := utils.NewObserver()
	deploymentService, stop := k8s.NewDeploymentService(context.TODO(), client, deploymentObserver)
	defer close(stop)

	podObserver := utils.NewObserver()
	podService, stop := k8s.NewPodService(context.TODO(), client, podObserver)
	defer close(stop)

	replicaSetService, stop := k8s.NewReplicaSetService(context.TODO(), client)
	defer close(stop)

	parentService := k8s.NewParentService(context.TODO(), client, replicaSetService)

	applicationService := envrouter.NewApplicationService(deploymentService, dataStorageFactory.NewApplicationStorage(), repositoryService)

	environmentService := envrouter.NewEnvironmentService(deploymentService)

	instanceService, stop := envrouter.NewInstanceService(deploymentService, eventsObserver, deploymentObserver)
	defer close(stop)

	instancePodService, stop := envrouter.NewInstancePodService(podService, eventsObserver, parentService, podObserver)
	defer close(stop)

	webhookService := envrouter.NewWebhookService()

	deployService := envrouter.NewDeployService(applicationService, webhookService)

	refService := envrouter.NewRefService(dataStorageFactory.NewRefBindingStorage(), environmentService, applicationService, deployService, eventsObserver)

	gitClient := envrouter.NewGitClient(repositoryService, credentialsSecretService)

	gitStorage := envrouter.NewGitStorage(gitClient, eventsObserver)

	gitScanJob := envrouter.NewGitScanJob(repositoryService, gitStorage)
	go gitScanJob.Scan()

	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	router.Use(cors.New(config))

	server := &ServerInterfaceImpl{
		repositoryService,
		credentialsSecretService,
		applicationService,
		environmentService,
		instanceService,
		instancePodService,
		refService,
		eventsObserver,
		gitStorage,
	}
	router.GET("/api/v1/subscription", server.streamPods)
	router.GET("/healthz", func(c *gin.Context) {
		c.Data(200, "text/plain", []byte("ok"))
	})
	router.Use(static.Serve("/", static.LocalFile("./public", true)))

	api.RegisterHandlers(router, server)

	err = router.Run("0.0.0.0:8080")
	if err != nil {
		panic(err)
	}
}

type ServerInterfaceImpl struct {
	repositoryService        envrouter.RepositoryService
	credentialsSecretService envrouter.CredentialsSecretService
	applicationService       envrouter.ApplicationService
	environmentService       envrouter.EnvironmentService
	instanceService          envrouter.InstanceService
	instancePodService       envrouter.InstancePodService
	refService               envrouter.RefService
	eventsObserver           utils.Observer
	gitStorage               envrouter.GitStorage
}

func (s *ServerInterfaceImpl) GetApiV1Repositories(c *gin.Context) {
	result, err := s.repositoryService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1Repositories(c *gin.Context) {
	var json api.Repository
	if err := c.ShouldBindJSON(&json); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.repositoryService.Save(&json)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) DeleteApiV1RepositoriesName(c *gin.Context, name string) {
	err := s.repositoryService.DeleteByName(name)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
}

func (s *ServerInterfaceImpl) GetApiV1CredentialsSecrets(c *gin.Context) {
	result, err := s.credentialsSecretService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1CredentialsSecrets(c *gin.Context) {
	var json api.CredentialsSecretRequest
	if err := c.ShouldBindJSON(&json); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.credentialsSecretService.Save(&json)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) DeleteApiV1CredentialsSecretsName(c *gin.Context, name string) {
	err := s.credentialsSecretService.DeleteByName(name)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
}

func (s *ServerInterfaceImpl) GetApiV1Applications(c *gin.Context) {
	result, err := s.applicationService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PutApiV1ApplicationsName(c *gin.Context, name string) {
	var json api.Application
	if err := c.ShouldBindJSON(&json); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if json.Name != name {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Names in path and body are different"})
		return
	}
	result, err := s.applicationService.Save(&json)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1Environments(c *gin.Context) {
	result, err := s.environmentService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1Instances(c *gin.Context) {
	result, err := s.instanceService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1InstancePods(c *gin.Context) {
	result, err := s.instancePodService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1RefBindings(c *gin.Context, params api.GetApiV1RefBindingsParams) {
	result, err := s.refService.FindAllBindings(params.Environment, params.Application, params.Ref)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1RefBindings(c *gin.Context) {
	var json api.RefBinding
	if err := c.ShouldBindJSON(&json); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.refService.SaveBinding(&json)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1GitRepositoriesRepositoryNameCommitsSha(c *gin.Context, repositoryName string, sha string) {
	result, err := s.gitStorage.GetCommitByHash(repositoryName, sha)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1GitRefs(c *gin.Context) {
	result, err := s.gitStorage.GetAllRefsHeads()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.IndentedJSON(200, result)
	}
}

func (s *ServerInterfaceImpl) streamPods(c *gin.Context) {
	// Buffered channel + non-blocking send: a slow or gone client drops
	// events instead of blocking publishers (git scanner, k8s informers).
	subscriber := make(chan api.SSEvent, 256)
	handler := utils.ObserverEventHandlerFuncs{
		EventFunc: func(oldObj interface{}, newObj interface{}) {
			select {
			case subscriber <- newObj.(api.SSEvent):
			default:
			}
		},
	}
	s.eventsObserver.Subscribe(&handler)
	defer s.eventsObserver.Unsubscribe(&handler)

	// Snapshot is collected after Subscribe so a client can never miss an
	// update that happened between its initial GETs and this subscription.
	snapshot := s.collectSnapshot()

	ticker := time.NewTicker(time.Second * 10)
	defer ticker.Stop()
	c.Stream(func(w io.Writer) bool {
		if len(snapshot) > 0 {
			c.SSEvent("", snapshot[0])
			snapshot = snapshot[1:]
			return true
		}
		select {
		case event := <-subscriber:
			c.SSEvent("", event)
		case <-ticker.C:
			c.SSEvent("", api.SSEvent{ItemType: "Ping"})
		case <-c.Request.Context().Done():
			return false
		}
		return true
	})
}

func (s *ServerInterfaceImpl) collectSnapshot() []api.SSEvent {
	var events []api.SSEvent
	if instances, err := s.instanceService.FindAll(); err == nil {
		for _, v := range instances {
			events = append(events, api.SSEvent{ItemType: "Instance", Item: v, Event: "UPDATED"})
		}
	} else {
		log.Errorf("SSE snapshot: instances: %v", err)
	}
	if pods, err := s.instancePodService.FindAll(); err == nil {
		for _, v := range pods {
			events = append(events, api.SSEvent{ItemType: "InstancePod", Item: v, Event: "UPDATED"})
		}
	} else {
		log.Errorf("SSE snapshot: instance pods: %v", err)
	}
	if refs, err := s.gitStorage.GetAllRefsHeads(); err == nil {
		for _, v := range refs {
			events = append(events, api.SSEvent{ItemType: "RefHead", Item: v, Event: "UPDATED"})
		}
	} else {
		log.Errorf("SSE snapshot: refs: %v", err)
	}
	if bindings, err := s.refService.FindAllBindings(nil, nil, nil); err == nil {
		for _, v := range bindings {
			events = append(events, api.SSEvent{ItemType: "RefBinding", Item: v, Event: "UPDATED"})
		}
	} else {
		log.Errorf("SSE snapshot: ref bindings: %v", err)
	}
	return events
}
