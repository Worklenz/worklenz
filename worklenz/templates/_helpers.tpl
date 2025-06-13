{{/*
Expand the name of the chart.
*/}}
{{- define "worklenz.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "worklenz.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "worklenz.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "worklenz.labels" -}}
helm.sh/chart: {{ include "worklenz.chart" . }}
{{ include "worklenz.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "worklenz.selectorLabels" -}}
app.kubernetes.io/name: {{ include "worklenz.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "worklenz.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "worklenz.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend Selector labels
*/}}
{{- define "worklenz.backendSelectorLabels" -}}
{{ include "worklenz.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend Selector labels
*/}}
{{- define "worklenz.frontendSelectorLabels" -}}
{{ include "worklenz.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}
