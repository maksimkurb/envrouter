package k8s

import (
	"testing"

	apiv1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSecretIsManaged(t *testing.T) {
	s := &secretDataStorage{secretTypeLabelValue: CredentialsSecretTypeLabelValue}

	cases := []struct {
		name   string
		labels map[string]string
		want   bool
	}{
		{"envrouter-managed", map[string]string{SecretTypeLabelKey: CredentialsSecretTypeLabelValue}, true},
		{"no labels", nil, false},
		{"wrong type", map[string]string{SecretTypeLabelKey: "something-else"}, false},
		{"unrelated label only", map[string]string{"app": "postgres"}, false},
	}
	for _, tc := range cases {
		secret := &apiv1.Secret{ObjectMeta: metav1.ObjectMeta{Labels: tc.labels}}
		if got := s.secretIsManaged(secret); got != tc.want {
			t.Errorf("%s: secretIsManaged = %v, want %v", tc.name, got, tc.want)
		}
	}
	if s.secretIsManaged(nil) {
		t.Error("nil secret must not be considered managed")
	}
}
