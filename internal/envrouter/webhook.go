package envrouter

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type WebhookService interface {
	Invoke(webhook string) error
}

type webhookService struct {
	client *http.Client
}

func NewWebhookService() WebhookService {
	return &webhookService{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (w *webhookService) Invoke(webhook string) error {
	resp, err := w.client.PostForm(webhook, url.Values{})
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
