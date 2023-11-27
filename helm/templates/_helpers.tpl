{{- define "monokle-admission-controller.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "monokle-admission-controller.namespace" -}}
{{ .Release.Namespace }}
{{- end }}

{{- define "monokle-admission-controller.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "monokle-admission-controller.labels" -}}
helm.sh/chart: {{ include "monokle-admission-controller.chart" . }}
{{ include "monokle-admission-controller.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "monokle-admission-controller.selectorLabels" -}}
app.kubernetes.io/name: {{ include "monokle-admission-controller.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
