package main

import (
	"context"
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"gitlab.com/jonasasx/envrouter/internal/envrouter"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/api"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/auth"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/k8s"
	"gitlab.com/jonasasx/envrouter/internal/utils"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// SSE connection accounting (package-level to avoid churning the positional
// server struct literal); limit read once from env at startup.
var (
	activeSSE    atomic.Int64
	maxSSEConns  = envInt("ENVROUTER_MAX_SSE_CONNECTIONS", 500)
	maxBodyBytes = int64(envInt("ENVROUTER_MAX_BODY_BYTES", 1048576))
)

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

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

	auditLog := envrouter.NewAuditLog()

	refService := envrouter.NewRefService(dataStorageFactory.NewRefBindingStorage(), environmentService, applicationService, deployService, eventsObserver, auditLog)

	authService, err := auth.New(context.TODO(), auth.ConfigFromEnv())
	if err != nil {
		log.Fatalf("OIDC setup failed: %v", err)
	}

	gitClient := envrouter.NewGitClient(repositoryService, credentialsSecretService)

	gitStorage := envrouter.NewGitStorage(gitClient, eventsObserver)

	gitScanJob := envrouter.NewGitScanJob(repositoryService, gitStorage)
	go gitScanJob.Scan()

	router := gin.Default()

	// Trust only explicitly listed proxies so c.ClientIP() can't be forged via
	// a client-supplied X-Forwarded-For (audit log + webhook triggered-by IP).
	if proxies := splitTrimmed(os.Getenv("ENVROUTER_TRUSTED_PROXIES")); len(proxies) > 0 {
		if err := router.SetTrustedProxies(proxies); err != nil {
			log.Fatalf("invalid ENVROUTER_TRUSTED_PROXIES: %v", err)
		}
		log.Infof("Trusting proxies: %v", proxies)
	} else {
		_ = router.SetTrustedProxies(nil)
		log.Info("Trusting no proxies (using RemoteAddr for client IP)")
	}

	router.Use(securityHeaders())
	router.Use(bodyLimit())

	// CORS is off unless explicitly configured: the SPA is same-origin, so
	// nothing needs it, and an open policy lets any site script a visitor's
	// browser against every reachable envrouter (worse when OIDC is disabled).
	if origins := splitTrimmed(os.Getenv("ENVROUTER_CORS_ALLOWED_ORIGINS")); len(origins) > 0 {
		config := cors.DefaultConfig()
		config.AllowOrigins = origins
		config.AllowCredentials = true
		router.Use(cors.New(config))
		log.Infof("CORS enabled for origins: %v", origins)
	}
	// gzip REST payloads (large repetitive JSON compresses ~10x); SSE streams
	// are excluded — gzip buffering would break per-event flushing
	router.Use(gzip.Gzip(gzip.DefaultCompression, gzip.WithExcludedPaths([]string{
		"/api/v1/subscription",
		"/api/v2/subscription",
	})))
	// guards /api/* when OIDC is enabled; always attaches the request actor
	router.Use(authService.Middleware())

	router.GET("/auth/login", authService.LoginHandler)
	router.GET("/auth/callback", authService.CallbackHandler)
	router.POST("/auth/logout", authService.LogoutHandler)
	router.GET("/auth/userinfo", authService.UserinfoHandler)

	server := &ServerInterfaceImpl{
		repositoryService:        repositoryService,
		credentialsSecretService: credentialsSecretService,
		applicationService:       applicationService,
		environmentService:       environmentService,
		instanceService:          instanceService,
		instancePodService:       instancePodService,
		refService:               refService,
		eventsObserver:           eventsObserver,
		gitStorage:               gitStorage,
		authService:              authService,
	}
	router.GET("/api/v1/subscription", server.streamPods)
	router.GET("/api/v2/subscription", server.streamV2)
	router.GET("/api/v2/audit/refSwitches", func(c *gin.Context) {
		environment, application := c.Query("environment"), c.Query("application")
		var records []envrouter.RefSwitch
		if environment == "" && application == "" {
			records = auditLog.FindAll()
		} else {
			records = auditLog.Find(environment, application)
		}
		// IPs are admin-only
		if !authService.CanConfigure(auth.ActorFromContext(c)) {
			for i := range records {
				records[i].IP = ""
			}
		}
		c.JSON(200, records)
	})
	router.GET("/healthz", func(c *gin.Context) {
		c.Data(200, "text/plain", []byte("ok"))
	})
	router.Use(static.Serve("/", static.LocalFile("./public", true)))

	api.RegisterHandlers(router, server)

	// explicit server so we can set ReadHeaderTimeout (slowloris guard). No
	// WriteTimeout: it would kill long-lived SSE streams.
	srv := &http.Server{
		Addr:              "0.0.0.0:8080",
		Handler:           router,
		ReadHeaderTimeout: 15 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
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
	authService              *auth.Service
}

// splitTrimmed splits a comma list, trims spaces, and drops empties.
func splitTrimmed(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func securityHeaders() gin.HandlerFunc {
	hsts := os.Getenv("ENVROUTER_HSTS") == "true"
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.gravatar.com; font-src 'self' data:; connect-src 'self'")
		if hsts {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

func bodyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
		c.Next()
	}
}

func (s *ServerInterfaceImpl) GetApiV1Repositories(c *gin.Context) {
	result, err := s.repositoryService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1Repositories(c *gin.Context) {
	if !s.authService.CanConfigure(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to configure"})
		return
	}
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
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) DeleteApiV1RepositoriesName(c *gin.Context, name string) {
	if !s.authService.CanConfigure(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to configure"})
		return
	}
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
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1CredentialsSecrets(c *gin.Context) {
	if !s.authService.CanConfigure(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to configure"})
		return
	}
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
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) DeleteApiV1CredentialsSecretsName(c *gin.Context, name string) {
	if !s.authService.CanConfigure(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to configure"})
		return
	}
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
	}
	s.redactWebhooks(c, result)
	c.JSON(200, result)
}

// redactWebhooks blanks webhook URLs for non-admins. The URL embeds the
// pipeline-trigger token, so exposing it to view/deploy users would let them
// trigger deploys out-of-band, bypassing authz and the audit log. Safe to
// mutate: FindAll returns freshly unmarshalled, non-shared objects.
func (s *ServerInterfaceImpl) redactWebhooks(c *gin.Context, apps []*api.Application) {
	if s.authService.CanConfigure(auth.ActorFromContext(c)) {
		return
	}
	for _, a := range apps {
		a.Webhook = nil
	}
}

func (s *ServerInterfaceImpl) PutApiV1ApplicationsName(c *gin.Context, name string) {
	if !s.authService.CanConfigure(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to configure"})
		return
	}
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
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1Environments(c *gin.Context) {
	result, err := s.environmentService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1Instances(c *gin.Context) {
	result, err := s.instanceService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1InstancePods(c *gin.Context) {
	result, err := s.instancePodService.FindAll()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1RefBindings(c *gin.Context, params api.GetApiV1RefBindingsParams) {
	result, err := s.refService.FindAllBindings(params.Environment, params.Application, params.Ref)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) PostApiV1RefBindings(c *gin.Context) {
	if !s.authService.CanDeploy(auth.ActorFromContext(c)) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not permitted to deploy"})
		return
	}
	var json api.RefBinding
	if err := c.ShouldBindJSON(&json); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.refService.SaveBinding(&json, auth.ActorFromContext(c))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1GitRepositoriesRepositoryNameCommitsSha(c *gin.Context, repositoryName string, sha string) {
	result, err := s.gitStorage.GetCommitByHash(repositoryName, sha)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

func (s *ServerInterfaceImpl) GetApiV1GitRefs(c *gin.Context) {
	result, err := s.gitStorage.GetAllRefsHeads()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	} else {
		c.JSON(200, result)
	}
}

// subscribe registers a buffered, non-blocking event subscriber: a slow or
// gone client drops events instead of blocking publishers (git scanner,
// k8s informers). Caller must Unsubscribe the returned handler.
func (s *ServerInterfaceImpl) subscribe(buffer int, closeOnOverflow bool) (chan api.SSEvent, *utils.ObserverEventHandlerFuncs, <-chan struct{}) {
	subscriber := make(chan api.SSEvent, buffer)
	overflow := make(chan struct{}, 1)
	handler := &utils.ObserverEventHandlerFuncs{
		EventFunc: func(oldObj interface{}, newObj interface{}) {
			select {
			case subscriber <- newObj.(api.SSEvent):
			default:
				// buffer full: the client is too slow. v1 tolerates gaps (it
				// re-fetches via REST); v2's snapshot+deltas contract can't, so
				// signal overflow to close the stream and force a fresh snapshot.
				if closeOnOverflow {
					select {
					case overflow <- struct{}{}:
					default:
					}
				}
			}
		},
	}
	s.eventsObserver.Subscribe(handler)
	return subscriber, handler, overflow
}

func (s *ServerInterfaceImpl) streamEvents(c *gin.Context, subscriber chan api.SSEvent, overflow <-chan struct{}) {
	ticker := time.NewTicker(time.Second * 10)
	defer ticker.Stop()
	c.Stream(func(w io.Writer) bool {
		select {
		case event := <-subscriber:
			c.SSEvent("", event)
		case <-overflow:
			log.Warn("SSE subscriber buffer overflow; closing stream to force client resync")
			return false
		case <-ticker.C:
			c.SSEvent("", api.SSEvent{ItemType: "Ping"})
		case <-c.Request.Context().Done():
			return false
		}
		return true
	})
}

// streamPods is the v1 stream: live deltas only (the v1 UI fetches its own
// snapshot via the REST endpoints).
// acquireSSE enforces the global SSE connection cap. Returns false (and writes
// 503) when the limit is hit; on success the caller must defer releaseSSE.
func acquireSSE(c *gin.Context) bool {
	if activeSSE.Add(1) > int64(maxSSEConns) {
		activeSSE.Add(-1)
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "too many concurrent connections"})
		return false
	}
	return true
}

func releaseSSE() { activeSSE.Add(-1) }

func (s *ServerInterfaceImpl) streamPods(c *gin.Context) {
	if !acquireSSE(c) {
		return
	}
	defer releaseSSE()
	subscriber, handler, overflow := s.subscribe(256, false)
	defer s.eventsObserver.Unsubscribe(handler)
	s.streamEvents(c, subscriber, overflow)
}

// streamV2 delivers the complete dashboard state as ONE Snapshot event and
// then live deltas on the same ordered stream — no REST snapshot, no
// cross-channel races: the subscription is registered before the snapshot
// is built, and deltas that are already in the snapshot re-apply
// idempotently (events carry full objects).
func (s *ServerInterfaceImpl) streamV2(c *gin.Context) {
	if !acquireSSE(c) {
		return
	}
	defer releaseSSE()
	// larger buffer: it holds deltas while the snapshot is being built
	subscriber, handler, overflow := s.subscribe(1024, true)
	defer s.eventsObserver.Unsubscribe(handler)

	snapshot, err := s.buildSnapshot(c)
	if err != nil {
		// closing makes the client's auto-reconnect retry
		log.Errorf("SSE v2 snapshot: %v", err)
		return
	}
	c.SSEvent("", api.SSEvent{ItemType: "Snapshot", Item: snapshot, Event: "UPDATED"})
	c.Writer.Flush()
	s.streamEvents(c, subscriber, overflow)
}

func (s *ServerInterfaceImpl) buildSnapshot(c *gin.Context) (*api.Snapshot, error) {
	environments, err := s.environmentService.FindAll()
	if err != nil {
		return nil, err
	}
	applications, err := s.applicationService.FindAll()
	if err != nil {
		return nil, err
	}
	s.redactWebhooks(c, applications)
	refBindings, err := s.refService.SnapshotBindings()
	if err != nil {
		return nil, err
	}
	instances, err := s.instanceService.FindAll()
	if err != nil {
		return nil, err
	}
	instancePods, err := s.instancePodService.FindAll()
	if err != nil {
		return nil, err
	}
	refsHeads, err := s.gitStorage.GetAllRefsHeads()
	if err != nil {
		return nil, err
	}
	return &api.Snapshot{
		Environments: environments,
		Applications: applications,
		RefBindings:  refBindings,
		Instances:    instances,
		InstancePods: instancePods,
		RefsHeads:    refsHeads,
		DefaultRef:   envrouter.DefaultRef,
	}, nil
}
