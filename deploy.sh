#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration variables
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
REGION="us-central1"
REPO_NAME="soc-containers"
SERVICE_NAME="soc-ai-agent-service"

echo "============================================================"
echo "      GCP Deployer: SOC AI Incident Agent Pipeline         "
echo "============================================================"

# Ensure gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed."
    echo "Please install it from https://cloud.google.com/sdk/docs/install and try again."
    exit 1
fi

# Ensure user is logged in and project is set
if [ -z "$PROJECT_ID" ]; then
    echo "⚠️ Warning: No active GCP project configured in gcloud CLI."
    read -p "Please enter your GCP Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

echo "🔹 Using Project ID: $PROJECT_ID"
echo "🔹 Using Region: $REGION"

# 1. Enable required GCP Services
echo "🚀 Enabling required APIs (Cloud Run, Artifact Registry, Cloud Build)..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

# 2. Create Artifact Registry repository if it doesn't exist
echo "📦 Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
    echo "Creating repository '$REPO_NAME' in '$REGION'..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for SOC AI Agent"
else
    echo "✅ Repository '$REPO_NAME' already exists."
fi

# 3. Retrieve environment variables
if [ -f .env ]; then
    echo "🔑 Found .env file, loading environment..."
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ Error: GEMINI_API_KEY is not defined in environment or .env."
    read -sp "Please enter your Gemini API Key: " GEMINI_API_KEY
    echo ""
fi

if [ -z "$ES_URL" ]; then
    echo "ℹ️ ES_URL not found, default to elastic-cloud URL placeholder."
    ES_URL="https://your-elastic-cloud-url"
fi

if [ -z "$ES_API_KEY" ]; then
    echo "❌ Error: ES_API_KEY is not defined in environment or .env."
    read -sp "Please enter your Elasticsearch API Key: " ES_API_KEY
    echo ""
fi

if [ -z "$ELASTIC_MCP_URL" ]; then
    echo "ℹ️ ELASTIC_MCP_URL not found. Use the MCP server URL from Kibana > Agent Builder > Tools."
    ELASTIC_MCP_URL="https://your-elastic-agent-builder-mcp-url"
fi

# 4. Trigger Google Cloud Build
echo "🏗️ Submitting Cloud Build job to build and deploy to Cloud Run..."
gcloud builds submit --config=cloudbuild.yaml \
    --substitutions="_AR_REGION=$REGION,_AR_REPO=$REPO_NAME,_SERVICE_NAME=$SERVICE_NAME,_DEPLOY_REGION=$REGION,_ES_URL=$ES_URL,_ES_API_KEY=$ES_API_KEY,_ELASTIC_MCP_URL=$ELASTIC_MCP_URL,_GEMINI_API_KEY=$GEMINI_API_KEY"

echo "============================================================"
echo "🎉 Deployment initiated successfully!"
echo "Check your Cloud Run Console for service endpoint details."
echo "============================================================"
