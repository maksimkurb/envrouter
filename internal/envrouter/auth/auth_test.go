package auth

import (
	"net/http"
	"testing"

	"github.com/coreos/go-oidc/v3/oidc"
)

func TestIsLegacyReadPath(t *testing.T) {
	allowed := []string{
		"/api/v1/refBindings",
		"/api/v1/environments",
		"/api/v1/instances",
		"/api/v1/instancePods",
		"/api/v1/git/refs",
		"/api/v1/git/repositories/myrepo/commits/abc123",
	}
	for _, p := range allowed {
		if !isLegacyReadPath(p) {
			t.Errorf("expected %q to be an allowed legacy read", p)
		}
	}
	denied := []string{
		"/api/v1/repositories",
		"/api/v1/credentialsSecrets",
		"/api/v1/applications",
		"/api/v2/subscription",
		"/api/v2/audit/refSwitches",
		"/api/v1/refBindingsX", // boundary: must not prefix-match loosely
	}
	for _, p := range denied {
		if isLegacyReadPath(p) {
			t.Errorf("expected %q to NOT be an allowed legacy read", p)
		}
	}
}

func TestBearerToken(t *testing.T) {
	cases := map[string]string{
		"Bearer abc":  "abc",
		"bearer abc":  "abc", // case-insensitive scheme
		"Basic abc":   "",
		"Bearer":      "",
		"":            "",
		"Bearer a b ": "a b ",
	}
	for header, want := range cases {
		r := &http.Request{Header: http.Header{}}
		if header != "" {
			r.Header.Set("Authorization", header)
		}
		if got := bearerToken(r); got != want {
			t.Errorf("bearerToken(%q) = %q, want %q", header, got, want)
		}
	}
}

func TestPermittedAdminShortCircuits(t *testing.T) {
	// OIDC enabled (non-nil provider ⇒ Enabled()), a required group the actor
	// is NOT in — Admin must still be permitted at every level.
	s := &Service{provider: &oidc.Provider{}, cfg: Config{GroupConfigure: "admins"}}
	if !s.CanConfigure(Actor{Admin: true}) {
		t.Error("Admin actor must pass CanConfigure regardless of groups")
	}
	if s.CanConfigure(Actor{Groups: []string{"devs"}}) {
		t.Error("non-admin without the group must be denied")
	}
}
