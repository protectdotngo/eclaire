{{/*
Selector labels (stable across releases, used by Deployment/Service).
*/}}
{{- define "xenicibis.selectorLabels" -}}
{{ include "common.labels.matchLabels" . }}
{{- end -}}

{{/*
ServiceAccount name to use.
*/}}
{{- define "xenicibis.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "common.names.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
