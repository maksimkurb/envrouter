# Envrouter - Continuous Delivery Orchestrator for Kubernetes

## What is Envrouter?

### Development team problems

* When development team has multiple environments, every member wants to know what version of each service is deployed
on each environment.
* Also, every team member wants to set the git branch of the service expected on the environment.

### How Envrouter helps

* Envrouter shows every service at every environment, and it's git branch.
* Envrouter returns to CI/CD pipeline a list of environments the deploying service must be deployed.
* When user changes git branch in Envrouter table, Envrouter triggers deploying CI/CD pipeline.

![Envrouter UI](docs/assets/afcf9cd8e8.jpg)

# Install Envrouter

## Docker

    docker run -it -v $HOME/.kube/config:/home/envrouter/.kube/config jonasasx/envrouter:latest

## Helm install

    helm repo add envrouter https://jonasasx.github.io/envrouter-helm
    helm install my-release envrouter/envrouter

Helm reference: https://github.com/jonasasx/envrouter-helm/blob/master/charts/envrouter/README.md

## Authentication (optional, OIDC)

EnvRouter can require login through any OIDC discovery-compliant provider
(Keycloak, Authelia, …). Without configuration it runs open, as before.

| Env var | Default | Meaning |
|---|---|---|
| `ENVROUTER_OIDC_ISSUER` | *(empty = auth disabled)* | Issuer URL, e.g. `https://keycloak.example.com/realms/main` |
| `ENVROUTER_OIDC_CLIENT_ID` | — | OAuth client id (required when issuer set) |
| `ENVROUTER_OIDC_CLIENT_SECRET` | — | OAuth client secret |
| `ENVROUTER_OIDC_REDIRECT_URL` | — | Public callback URL, e.g. `https://envrouter.example.com/auth/callback` (required when issuer set) |
| `ENVROUTER_OIDC_SCOPES` | `openid profile email` | Requested scopes |
| `ENVROUTER_OIDC_CLAIM_USER_IDENTIFIER` | `preferred_username,sub` | Comma-separated claim fallback list for the user identifier (required field; login is rejected if all claims are empty) |
| `ENVROUTER_OIDC_CLAIM_FULLNAME` | `name` | Claim fallback list for the display name |
| `ENVROUTER_OIDC_CLAIM_EMAIL` | `email` | Claim fallback list for the email |
| `ENVROUTER_OIDC_INSECURE_COOKIE` | `false` | Set `true` for plain-HTTP dev setups |

When auth is enabled every `/api/*` route requires a session (the UI redirects
to the provider automatically). Every branch switch is recorded in an
in-memory audit log (user, IP, old/new ref — kept until restart, visible via
the history button next to each service's branch field), and deploy webhooks
receive GitLab pipeline-trigger variables in the form body:
`variables[ENVROUTER_OLD_REF]`, `variables[ENVROUTER_NEW_REF]`,
`variables[ENVROUTER_TRIGGERED_BY_USERNAME]`,
`variables[ENVROUTER_TRIGGERED_BY_FULLNAME]`,
`variables[ENVROUTER_TRIGGERED_BY_IP]`.

## Usage

Set label `envrouter.io/app=<your application name>` to `deployment.metadata.labels` and
`deployment.spec.template.metadata.labels`. Envrouter watches for such deployments and pods to display
at the dashboard.

CI/CD pipeline must set annotations:

* `envrouter.io/ref=%GIT_BRANCH_NAME%` to `metadata.annotations` and `spec.template.metadata.annotations` 
* `envrouter.io/sha=%GIT_COMMIT_SHA%` to `metadata.annotations` and `spec.template.metadata.annotations` 

Example:

    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: notifier
      namespace: qa2
      labels:
        envrouter.io/app: notifier
      annotations:
        envrouter.io/ref: main
        envrouter.io/sha: 87cf26c39505769e5fcf8133417f36e1883650f0
    spec:
      selector:
        matchLabels:
          app: notifier
      template:
        metadata:
          labels:
            app: notifier
            envrouter.io/app: notifier
          annotations:
            envrouter.io/ref: main
            envrouter.io/sha: 87cf26c39505769e5fcf8133417f36e1883650f0
        spec:
          containers:
            - name: notifier
              image: nginx:latest

