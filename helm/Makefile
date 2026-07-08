all: help

down: ## Undeploy mammuthus-camptorhynchus
	@helm uninstall -n mattermost mammuthus-camptorhynchus

up: ## Deploy mammuthus-camptorhynchus
	@helm upgrade -i mammuthus-camptorhynchus -n mattermost -f values-prod.yaml ./

encrypt-prod-values: ## Encrypt secret
	@sops --encrypt values-prod.yaml > values-prod.enc.yaml

decrypt-prod-values: ## Encrypt secret
	@sops --decrypt values-prod.enc.yaml > values-prod-dec.yaml

encrypt-dev-values: ## Encrypt secret
	@sops --encrypt values-dev.yaml > values-dev.enc.yaml

po: ## Get list of pods
	@kubectl -n mattermost get po

top: ## Show k8s top like app (k9s)
	k9s -n mattermost

help: ## Print this message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONE: down up po help
