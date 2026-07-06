package envrouter

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type WebhookService interface {
	Invoke(webhook string, variables map[string]string) error
}

type webhookService struct {
	client *http.Client
}

func NewWebhookService() WebhookService {
	return &webhookService{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (w *webhookService) Invoke(webhook string, variables map[string]string) error {
	// GitLab pipeline-trigger form format: variables[KEY]=value; composes
	// with token=/ref= query params already present in the configured URL
	form := url.Values{}
	for key, value := range variables {
		form.Set(fmt.Sprintf("variables[%s]", key), value)
	}
	resp, err := w.client.PostForm(webhook, form)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook %s returned status %d", webhook, resp.StatusCode)
	}
	return nil
}
