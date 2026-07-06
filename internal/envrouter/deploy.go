package envrouter

import (
	"strings"

	"gitlab.com/jonasasx/envrouter/internal/envrouter/auth"
)

type DeployMeta struct {
	OldRef string
	Actor  auth.Actor
}

type DeployService interface {
	Deploy(applicationName string, ref string, meta DeployMeta) error
}

type deployService struct {
	applicationService ApplicationService
	webhookService     WebhookService
}

func NewDeployService(
	applicationService ApplicationService,
	webhookService WebhookService,
) DeployService {
	return &deployService{
		applicationService,
		webhookService,
	}
}

func (d *deployService) Deploy(applicationName string, ref string, meta DeployMeta) error {
	application, err := d.applicationService.FindByName(applicationName)
	if err != nil {
		return err
	}
	if application.Webhook != nil {
		webhook := *application.Webhook
		webhook = strings.ReplaceAll(webhook, "{ref}", ref)
		// GitLab pipeline-trigger variables; empty values when auth is disabled
		variables := map[string]string{
			"ENVROUTER_TRIGGERED_BY_USERNAME": meta.Actor.UserIdentifier,
			"ENVROUTER_TRIGGERED_BY_FULLNAME": meta.Actor.FullName,
			"ENVROUTER_TRIGGERED_BY_IP":       meta.Actor.IP,
			"ENVROUTER_OLD_REF":               meta.OldRef,
			"ENVROUTER_NEW_REF":               ref,
		}
		return d.webhookService.Invoke(webhook, variables)
	}
	return nil
}
