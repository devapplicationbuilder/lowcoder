{{/*
Expand the name of the chart.
*/}}
{{- define "lowcoder.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "lowcoder.fullname" -}}
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
Allow the release namespace to be overridden for multi-namespace deployments in combined charts.
*/}}
{{- define "lowcoder.namespace" -}}
    {{- if .Values.global -}}
        {{- if .Values.global.namespaceOverride }}
            {{- .Values.global.namespaceOverride -}}
        {{- else -}}
            {{- .Release.Namespace -}}
        {{- end -}}
    {{- else -}}
        {{- .Release.Namespace -}}
    {{- end }}
{{- end -}}


{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lowcoder.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "lowcoder.labels" -}}
helm.sh/chart: {{ include "lowcoder.chart" . }}
{{ include "lowcoder.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "lowcoder.selectorLabels" -}}
{{- $name := include "lowcoder.name" . -}}
{{- $componentName := .component | default "" -}}
{{- if ne $componentName "" -}}
app.kubernetes.io/name: {{ $name }}-{{ $componentName }}
{{- else -}}
app.kubernetes.io/name: {{ $name }}
{{- end }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "lowcoder.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "lowcoder.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
