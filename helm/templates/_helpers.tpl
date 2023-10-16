{{- define "monokle-admission-controller.namespace" -}}
{{ default .Release.Namespace .Values.namespace }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "monokle-admission-controller.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "monokle-admission-controller.labels" -}}
helm.sh/chart: {{ include "monokle-admission-controller.chart" . }}
{{ include "monokle-admission-controller.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "monokle-admission-controller.selectorLabels" -}}
{{/*app.kubernetes.io/name: {{ include "monokle-admission-controller.name" . }} */}}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "monokle-admission-controller.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "monokle-admission-controller.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
