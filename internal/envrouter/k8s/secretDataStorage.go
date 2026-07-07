package k8s

import (
	"context"
	"fmt"
	apiv1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type SecretDataStorage interface {
	Save(key string, data map[string][]byte) error
	ListByLabel() (map[string]map[string][]byte, error)
	GetByName(name string) (map[string][]byte, error)
	DeleteByName(name string) error
}

type secretDataStorage struct {
	ctx                  context.Context
	client               *client
	namespace            string
	secretTypeLabelValue string
}

func NewSecretDataStorage(
	ctx context.Context,
	client *client,
	namespace string,
	secretTypeLabelValue string,
) SecretDataStorage {
	return &secretDataStorage{
		ctx:                  ctx,
		client:               client,
		namespace:            namespace,
		secretTypeLabelValue: secretTypeLabelValue,
	}
}
func (s *secretDataStorage) Save(key string, data map[string][]byte) error {
	clientset, _, err := s.client.getK8sClient()
	if err != nil {
		return err
	}
	return retryOnWriteConflict(func() error {
		var new bool
		secret, err := clientset.CoreV1().Secrets(s.namespace).Get(s.ctx, key, metav1.GetOptions{})
		if err != nil {
			if !k8serrors.IsNotFound(err) {
				return err
			}
			new = true
		}
		if new {
			secret = &apiv1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      key,
					Namespace: s.namespace,
					Labels: map[string]string{
						SecretTypeLabelKey: s.secretTypeLabelValue,
					},
				},
			}
		} else if !s.secretIsManaged(secret) {
			// Never overwrite a pre-existing secret we don't own: refuse rather
			// than clobber an unrelated secret whose name happens to collide.
			return fmt.Errorf("refusing to overwrite secret %q: not managed by envrouter", key)
		}

		secret.Data = data

		if new {
			_, err = clientset.CoreV1().Secrets(s.namespace).Create(s.ctx, secret, metav1.CreateOptions{})
		} else {
			_, err = clientset.CoreV1().Secrets(s.namespace).Update(s.ctx, secret, metav1.UpdateOptions{})
		}

		return err
	})
}

func (s *secretDataStorage) ListByLabel() (map[string]map[string][]byte, error) {
	clientset, _, err := s.client.getK8sClient()
	if err != nil {
		return nil, err
	}
	list, err := clientset.CoreV1().Secrets(s.namespace).List(s.ctx, metav1.ListOptions{LabelSelector: SecretTypeLabelKey + "=" + s.secretTypeLabelValue})
	if err != nil {
		return nil, err
	}
	result := map[string]map[string][]byte{}
	for _, v := range list.Items {
		result[v.Name] = v.Data
	}
	return result, nil
}

func (s *secretDataStorage) GetByName(name string) (map[string][]byte, error) {
	clientset, _, err := s.client.getK8sClient()
	if err != nil {
		return nil, err
	}
	item, err := clientset.CoreV1().Secrets(s.namespace).Get(s.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	// Same guard as delete: a name is user-controlled (a repository's
	// credentialsSecret field), so only ever hand back secrets envrouter
	// manages — never leak an unrelated secret's data.
	if !s.secretIsManaged(item) {
		return nil, fmt.Errorf("secret %q is not managed by envrouter", name)
	}
	return item.Data, nil
}

func (s *secretDataStorage) DeleteByName(name string) error {
	clientset, _, err := s.client.getK8sClient()
	if err != nil {
		return err
	}
	// Only ever delete secrets envrouter itself manages: a name is
	// user-controlled (DELETE .../credentialsSecrets/:name), so without this
	// check a crafted name could wipe an unrelated secret (TLS, another app's)
	// living in the same namespace.
	secret, err := clientset.CoreV1().Secrets(s.namespace).Get(s.ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if !s.secretIsManaged(secret) {
		return fmt.Errorf("refusing to delete secret %q: not managed by envrouter", name)
	}
	// UID precondition deletes exactly the object we validated, closing the
	// relabel-between-get-and-delete race.
	return clientset.CoreV1().Secrets(s.namespace).Delete(s.ctx, name, metav1.DeleteOptions{
		Preconditions: &metav1.Preconditions{UID: &secret.UID},
	})
}

// secretIsManaged reports whether a secret carries envrouter's type label and
// is therefore safe to mutate/delete on the user's behalf.
func (s *secretDataStorage) secretIsManaged(secret *apiv1.Secret) bool {
	return secret != nil && secret.Labels[SecretTypeLabelKey] == s.secretTypeLabelValue
}
