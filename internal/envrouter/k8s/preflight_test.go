package k8s

import (
	"errors"
	"strings"
	"testing"
)

func TestCollectDenied_ClusterWideAllowed(t *testing.T) {
	allow := func(ns, group, resource, verb string) (bool, error) { return true, nil }
	if d := collectDenied(allow, nil, "envrouter"); len(d) != 0 {
		t.Fatalf("expected no denials, got %v", d)
	}
}

func TestCollectDenied_ClusterWideScopeLabel(t *testing.T) {
	// Deny everything; empty namespace list must check cluster-wide.
	deny := func(ns, group, resource, verb string) (bool, error) { return false, nil }
	d := collectDenied(deny, nil, "envrouter")
	if len(d) == 0 {
		t.Fatal("expected denials")
	}
	for _, msg := range d {
		if strings.Contains(msg, "deployments") && !strings.Contains(msg, "cluster-wide") {
			t.Fatalf("watched resource should report cluster-wide scope: %q", msg)
		}
	}
}

func TestCollectDenied_NamespaceScoped(t *testing.T) {
	// Allow watch resources only in "team-a", deny "team-b"; config resources
	// (configmaps/secrets) live in configNs and are allowed there.
	run := func(ns, group, resource, verb string) (bool, error) {
		if resource == "configmaps" || resource == "secrets" {
			return ns == "envrouter", nil
		}
		return ns == "team-a", nil
	}
	d := collectDenied(run, []string{"team-a", "team-b"}, "envrouter")
	if len(d) == 0 {
		t.Fatal("expected team-b denials")
	}
	for _, msg := range d {
		if !strings.Contains(msg, "namespace team-b") {
			t.Fatalf("only team-b should be denied, got %q", msg)
		}
	}
}

func TestCollectDenied_ReviewErrorIsDenial(t *testing.T) {
	boom := func(ns, group, resource, verb string) (bool, error) { return false, errors.New("forbidden") }
	d := collectDenied(boom, []string{"team-a"}, "envrouter")
	if len(d) == 0 || !strings.Contains(d[0], "access review failed") {
		t.Fatalf("review error should surface as denial, got %v", d)
	}
}
