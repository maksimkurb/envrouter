// Package auth provides optional OIDC authentication (Keycloak, Authelia, or
// any discovery-compliant provider). It is enabled by setting
// ENVROUTER_OIDC_ISSUER; without it every request passes through with an
// anonymous actor. Sessions are cookie-based (the raw ID token in an
// HttpOnly cookie) because EventSource cannot send Authorization headers.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"golang.org/x/oauth2"
)

const (
	sessionCookie = "envrouter_session"
	stateCookie   = "envrouter_oauth_state"
	actorKey      = "envrouter_actor"
)

// Actor identifies who performs an API request.
type Actor struct {
	UserIdentifier string
	FullName       string
	Email          string
	IP             string
	Groups         []string
}

type Config struct {
	Issuer         string
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	Scopes         []string
	InsecureCookie bool
	// Claim mapping: fallback lists of OIDC claim names, first non-empty wins.
	ClaimUserID   []string
	ClaimFullName []string
	ClaimEmail    []string
	ClaimGroups   []string
	// Group required at each authorization level; empty = allow all
	// authenticated users at that level.
	GroupView      string
	GroupDeploy    string
	GroupConfigure string
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitClaims(s string) []string {
	var result []string
	for _, part := range strings.Split(s, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func ConfigFromEnv() Config {
	scopes := strings.Fields(strings.ReplaceAll(getEnv("ENVROUTER_OIDC_SCOPES", "openid profile email"), ",", " "))
	return Config{
		Issuer:         os.Getenv("ENVROUTER_OIDC_ISSUER"),
		ClientID:       os.Getenv("ENVROUTER_OIDC_CLIENT_ID"),
		ClientSecret:   os.Getenv("ENVROUTER_OIDC_CLIENT_SECRET"),
		RedirectURL:    os.Getenv("ENVROUTER_OIDC_REDIRECT_URL"),
		Scopes:         scopes,
		InsecureCookie: os.Getenv("ENVROUTER_OIDC_INSECURE_COOKIE") == "true",
		// defaults work with Keycloak and Authelia out of the box; sub is
		// always present per the OIDC spec, so the required field can't
		// end up empty with default mapping
		ClaimUserID:    splitClaims(getEnv("ENVROUTER_OIDC_CLAIM_USER_IDENTIFIER", "preferred_username,sub")),
		ClaimFullName:  splitClaims(getEnv("ENVROUTER_OIDC_CLAIM_FULLNAME", "name")),
		ClaimEmail:     splitClaims(getEnv("ENVROUTER_OIDC_CLAIM_EMAIL", "email")),
		ClaimGroups:    splitClaims(getEnv("ENVROUTER_OIDC_CLAIM_GROUPS", "groups")),
		GroupView:      os.Getenv("ENVROUTER_OIDC_GROUP_VIEW"),
		GroupDeploy:    os.Getenv("ENVROUTER_OIDC_GROUP_DEPLOY"),
		GroupConfigure: os.Getenv("ENVROUTER_OIDC_GROUP_CONFIGURE"),
	}
}

type Service struct {
	cfg      Config
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
	oauth    oauth2.Config
}

func New(ctx context.Context, cfg Config) (*Service, error) {
	if cfg.Issuer == "" {
		log.Info("OIDC authentication disabled (ENVROUTER_OIDC_ISSUER not set)")
		return &Service{cfg: cfg}, nil
	}
	if cfg.ClientID == "" || cfg.RedirectURL == "" {
		return nil, errors.New("ENVROUTER_OIDC_CLIENT_ID and ENVROUTER_OIDC_REDIRECT_URL are required when ENVROUTER_OIDC_ISSUER is set")
	}
	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, fmt.Errorf("OIDC discovery for %s failed: %w", cfg.Issuer, err)
	}
	log.Infof("OIDC authentication enabled, issuer %s", cfg.Issuer)
	return &Service{
		cfg:      cfg,
		provider: provider,
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
		oauth: oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.RedirectURL,
			Scopes:       cfg.Scopes,
		},
	}, nil
}

func (s *Service) Enabled() bool {
	return s.provider != nil
}

// permitted reports whether the actor may act at a level whose required group
// is `group`. Auth disabled ⇒ always allowed; empty group ⇒ any authenticated
// user; otherwise the actor must be a member.
func (s *Service) permitted(a Actor, group string) bool {
	if !s.Enabled() {
		return true
	}
	if group == "" {
		return true
	}
	return containsString(a.Groups, group)
}

// Levels are hierarchical: configure ⊃ deploy ⊃ view, so an admin needs only
// the configure group, an editor only the deploy group.
func (s *Service) CanView(a Actor) bool      { return s.permitted(a, s.cfg.GroupView) || s.CanDeploy(a) }
func (s *Service) CanDeploy(a Actor) bool    { return s.permitted(a, s.cfg.GroupDeploy) || s.CanConfigure(a) }
func (s *Service) CanConfigure(a Actor) bool { return s.permitted(a, s.cfg.GroupConfigure) }

// safeRedirect sanitizes the `rd` param to a same-site absolute path, defeating
// open-redirect tricks including backslash normalization. Query string is
// dropped.
func safeRedirect(rd string) string {
	if rd == "" || strings.ContainsAny(rd, "\\") {
		return "/"
	}
	u, err := url.Parse(rd)
	if err != nil || u.IsAbs() || u.Host != "" || !strings.HasPrefix(u.Path, "/") || strings.HasPrefix(u.Path, "//") || strings.HasPrefix(u.Path, "/auth/") {
		return "/"
	}
	return u.Path
}

func resolveClaim(claims map[string]interface{}, fallbacks []string) string {
	for _, name := range fallbacks {
		if v, ok := claims[name].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

// resolveClaimSlice walks the fallback list and returns the first claim whose
// value is a non-empty list of strings (OIDC claims arrive as []interface{}).
func resolveClaimSlice(claims map[string]interface{}, fallbacks []string) []string {
	for _, name := range fallbacks {
		raw, ok := claims[name].([]interface{})
		if !ok {
			continue
		}
		var result []string
		for _, e := range raw {
			if s, ok := e.(string); ok && s != "" {
				result = append(result, s)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return nil
}

func containsString(list []string, v string) bool {
	for _, e := range list {
		if e == v {
			return true
		}
	}
	return false
}

func (s *Service) actorFromIDToken(ctx context.Context, rawIDToken string) (Actor, error) {
	idToken, err := s.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return Actor{}, err
	}
	claims := map[string]interface{}{}
	if err := idToken.Claims(&claims); err != nil {
		return Actor{}, err
	}
	actor := Actor{
		UserIdentifier: resolveClaim(claims, s.cfg.ClaimUserID),
		FullName:       resolveClaim(claims, s.cfg.ClaimFullName),
		Email:          resolveClaim(claims, s.cfg.ClaimEmail),
		Groups:         resolveClaimSlice(claims, s.cfg.ClaimGroups),
	}
	if actor.UserIdentifier == "" {
		return Actor{}, fmt.Errorf("none of the claims %v yielded a user identifier", s.cfg.ClaimUserID)
	}
	return actor, nil
}

// Middleware guards /api/* when auth is enabled and attaches the Actor to
// the gin context in every mode.
func (s *Service) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !s.Enabled() || !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Set(actorKey, Actor{IP: c.ClientIP()})
			c.Next()
			return
		}
		rawIDToken, err := c.Cookie(sessionCookie)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		actor, err := s.actorFromIDToken(c.Request.Context(), rawIDToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session invalid or expired"})
			return
		}
		actor.IP = c.ClientIP()
		// re-check on every request, not just at login: group config may have
		// changed since the session cookie was issued
		if !s.CanView(actor) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "your account is not in a group permitted to view EnvRouter"})
			return
		}
		c.Set(actorKey, actor)
		c.Next()
	}
}

// ActorFromContext returns the request actor; anonymous (IP only) when auth
// is disabled.
func ActorFromContext(c *gin.Context) Actor {
	if v, ok := c.Get(actorKey); ok {
		if actor, ok := v.(Actor); ok {
			return actor
		}
	}
	return Actor{IP: c.ClientIP()}
}

func randomNonce() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) LoginHandler(c *gin.Context) {
	if !s.Enabled() {
		c.Redirect(http.StatusFound, "/")
		return
	}
	rd := safeRedirect(c.Query("rd"))
	nonce, err := randomNonce()
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(stateCookie, nonce+"|"+url.QueryEscape(rd), 600, "/", "", !s.cfg.InsecureCookie, true)
	c.Redirect(http.StatusFound, s.oauth.AuthCodeURL(nonce))
}

func (s *Service) CallbackHandler(c *gin.Context) {
	if !s.Enabled() {
		c.Redirect(http.StatusFound, "/")
		return
	}
	stateValue, err := c.Cookie(stateCookie)
	if err != nil {
		c.String(http.StatusBadRequest, "missing login state; start again at /auth/login")
		return
	}
	nonce, escapedRd, found := strings.Cut(stateValue, "|")
	if !found || c.Query("state") != nonce {
		c.String(http.StatusBadRequest, "login state mismatch; start again at /auth/login")
		return
	}
	unescapedRd, _ := url.QueryUnescape(escapedRd)
	rd := safeRedirect(unescapedRd)
	token, err := s.oauth.Exchange(c.Request.Context(), c.Query("code"))
	if err != nil {
		log.Errorf("OIDC code exchange failed: %v", err)
		c.String(http.StatusBadGateway, "token exchange with the identity provider failed")
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		c.String(http.StatusBadGateway, "identity provider returned no id_token")
		return
	}
	actor, err := s.actorFromIDToken(c.Request.Context(), rawIDToken)
	if err != nil {
		log.Errorf("OIDC id_token rejected: %v", err)
		c.String(http.StatusUnauthorized, "identity token rejected: %v", err)
		return
	}
	if !s.CanView(actor) {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(sessionCookie, "", -1, "/", "", !s.cfg.InsecureCookie, true)
		c.SetCookie(stateCookie, "", -1, "/", "", !s.cfg.InsecureCookie, true)
		c.String(http.StatusForbidden, "your account is not in a group permitted to use EnvRouter")
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	// session cookie (no Max-Age): the ID token's own expiry is enforced on
	// every request by the verifier
	c.SetCookie(sessionCookie, rawIDToken, 0, "/", "", !s.cfg.InsecureCookie, true)
	c.SetCookie(stateCookie, "", -1, "/", "", !s.cfg.InsecureCookie, true)
	c.Redirect(http.StatusFound, rd)
}

func (s *Service) LogoutHandler(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(sessionCookie, "", -1, "/", "", !s.cfg.InsecureCookie, true)
	c.Status(http.StatusNoContent)
}

func (s *Service) UserinfoHandler(c *gin.Context) {
	if !s.Enabled() {
		// auth disabled: anonymous actor can do everything
		c.JSON(http.StatusOK, gin.H{
			"enabled":       false,
			"authenticated": false,
			"canDeploy":     s.CanDeploy(Actor{}),
			"canConfigure":  s.CanConfigure(Actor{}),
		})
		return
	}
	if rawIDToken, err := c.Cookie(sessionCookie); err == nil {
		if actor, err := s.actorFromIDToken(c.Request.Context(), rawIDToken); err == nil {
			c.JSON(http.StatusOK, gin.H{
				"enabled":        true,
				"authenticated":  true,
				"userIdentifier": actor.UserIdentifier,
				"fullName":       actor.FullName,
				"email":          actor.Email,
				"groups":         actor.Groups,
				"canView":        s.CanView(actor),
				"canDeploy":      s.CanDeploy(actor),
				"canConfigure":   s.CanConfigure(actor),
			})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"enabled":       true,
		"authenticated": false,
		"canDeploy":     s.CanDeploy(Actor{}),
		"canConfigure":  s.CanConfigure(Actor{}),
	})
}
