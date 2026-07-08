# micropachycephalosaurus Helm chart

Deploys the Astro Node SSR application (the image built by `Dockerfile`, published to
GitLab's container registry) to Kubernetes. Intended to be deployed by Argo CD.

## Layout

| File | Purpose |
| --- | --- |
| `Chart.yaml` | Chart metadata; depends on the Bitnami `common` library. |
| `values.yaml` | Defaults (image, resources, service, ingress, plain config); secret values left empty. |
| `templates/configmap.yaml` | Non-secret env (`MODE`, `CORS_ORIGIN`, `HOST`, `PORT`, `DB_URL`, `DB_PORT`, `DB_NAME`). |
| `templates/secret.yaml` | Secret env (API keys, GCP key, DB creds). |
| `templates/secret-docker.yaml` | `dockerconfigjson` pull secret for the GitLab registry. |
| `templates/deployment.yaml` | Deployment wiring config + secrets via `envFrom`. |
| `templates/service.yaml`, `ingress.yaml`, `serviceaccount.yaml` | Networking & identity. |

## Build the chart dependency

The `common` library is pulled from the Bitnami OCI registry:

```sh
helm dependency build ./helm
```

## Secrets

The sensitive values are intentionally empty in `values.yaml`:

- `secrets.*` — `OPENAI_API_KEY`, `ACCESS_KEY_ID`, `ACCESS_KEY_SECRET`, the `VERIFY_GCP_*`
  values, `SCALEWAY_API_KEY`, `SCW_SECRET_KEY`, `DB_USER`, `DB_PASS`.
- `dockerConfig` — base64-encoded `.dockerconfigjson` for the GitLab registry.

Supply them from your Argo CD Application rather than committing them. For example:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: micropachycephalosaurus
spec:
  source:
    repoURL: https://gitlab.com/cyberpeaceinstitute/micropachycephalosaurus.git
    path: helm
    helm:
      valuesObject:
        secrets:
          OPENAI_API_KEY: <from your secret store>
          DB_PASS: <...>
        dockerConfig: <base64 dockerconfigjson>
  destination:
    namespace: xenicibis
    server: https://kubernetes.default.svc
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

In practice, keep the actual secret material out of Git — reference it through an Argo CD
secret-management plugin (e.g. argocd-vault-plugin / External Secrets) or a pre-created
Kubernetes Secret.

Generate the `dockerConfig` value with:

```sh
kubectl create secret docker-registry tmp \
  --docker-server=registry.gitlab.com \
  --docker-username=<deploy-token-user> \
  --docker-password=<deploy-token> \
  --dry-run=client -o jsonpath='{.data.\.dockerconfigjson}'
```

## Notes

- The container listens on `4321` (`service.targetPort`); the Service exposes `80`.
- Ingress is enabled for `case.protect.ngo` with TLS secret `case-protect-ngo-tls`.
  Set `ingress.className` and/or cert-manager annotations to match your cluster.
- Liveness/readiness probes hit `/` — point them at a dedicated health endpoint if one exists.
- Update `image.repository`/`image.tag` to match what the GitLab CI pipeline pushes.
