#!/usr/bin/env bash
set -euo pipefail

# AUM Context Foundry - Production Cloud Run Deployment Script
# Usage:
#   1) Edit the CONFIG block below.
#   2) Ensure required secrets already exist in Secret Manager.
#   3) Run: bash deploy/prod_cloud_run.sh

########################################
# CONFIG - EDIT THESE VALUES
########################################
PROJECT_ID="gen-lang-client-0350122978"
REGION="asia-southeast1"
SERVICE_NAME="aum-api"
AR_REPO="aum-backend"
IMAGE_TAG="prod-1"

# Your domains
API_DOMAIN="api.aumcontextfoundry.com"
APP_DOMAIN="www.aumcontextfoundry.com"

# Runtime service account to run Cloud Run service.
# If empty, script uses the default Compute Engine SA:
#   PROJECT_NUMBER-compute@developer.gserviceaccount.com
RUNTIME_SA=""

# Optional toggles
DEPLOY_FIRESTORE_RULES_AND_INDEXES="true"   # requires firebase CLI auth
CREATE_CRON_JOB="true"                       # creates daily quota reset scheduler
ALLOW_UNAUTHENTICATED="true"                 # public API endpoint

# Secret names in Secret Manager (defaults match code/env names)
SECRET_JWT_SECRET="JWT_SECRET"
SECRET_SSO_ENCRYPTION_KEY="SSO_ENCRYPTION_KEY"
SECRET_SSO_JWT_SECRET="SSO_JWT_SECRET"
SECRET_OPENAI_API_KEY="OPENAI_API_KEY"
SECRET_GEMINI_API_KEY="GEMINI_API_KEY"
SECRET_ANTHROPIC_API_KEY="ANTHROPIC_API_KEY"
SECRET_RAZORPAY_KEY_ID="RAZORPAY_KEY_ID"
SECRET_RAZORPAY_KEY_SECRET="RAZORPAY_KEY_SECRET"
SECRET_RAZORPAY_WEBHOOK_SECRET="RAZORPAY_WEBHOOK_SECRET"
SECRET_CRON_SECRET="CRON_SECRET"
SECRET_RESEND_API_KEY="RESEND_API_KEY"

# Repo root (script assumes it is run from repo root if left as ".")
REPO_ROOT="."

########################################
# PRECHECKS
########################################
command -v gcloud >/dev/null || { echo "ERROR: gcloud not found"; exit 1; }
command -v git >/dev/null || { echo "ERROR: git not found"; exit 1; }

if [[ ! -d "${REPO_ROOT}/backend" ]]; then
  echo "ERROR: backend directory not found at ${REPO_ROOT}/backend"
  exit 1
fi

if [[ "${PROJECT_ID}" == "YOUR_GCP_PROJECT_ID" ]]; then
  echo "ERROR: Set PROJECT_ID in CONFIG block."
  exit 1
fi
if [[ "${API_DOMAIN}" == "api.YOURDOMAIN.com" || "${APP_DOMAIN}" == "app.YOURDOMAIN.com" ]]; then
  echo "ERROR: Set API_DOMAIN and APP_DOMAIN in CONFIG block."
  exit 1
fi

echo "==> Using project: ${PROJECT_ID}"
echo "==> Region: ${REGION}"
echo "==> Service: ${SERVICE_NAME}"

########################################
# GCLOUD PROJECT + APIS
########################################
gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com >/dev/null

########################################
# OPTIONAL: FIRESTORE RULES + INDEXES
########################################
if [[ "${DEPLOY_FIRESTORE_RULES_AND_INDEXES}" == "true" ]]; then
  if command -v firebase >/dev/null; then
    echo "==> Deploying Firestore rules and indexes"
    (cd "${REPO_ROOT}" && firebase deploy --only firestore:rules,firestore:indexes)
  else
    echo "WARN: firebase CLI not installed. Skipping firestore deploy."
    echo "      Install and run manually:"
    echo "      firebase deploy --only firestore:rules,firestore:indexes"
  fi
fi

########################################
# VERIFY REQUIRED SECRETS EXIST
########################################
REQUIRED_SECRETS=(
  "${SECRET_JWT_SECRET}"
  "${SECRET_SSO_ENCRYPTION_KEY}"
  "${SECRET_SSO_JWT_SECRET}"
  "${SECRET_OPENAI_API_KEY}"
  "${SECRET_GEMINI_API_KEY}"
  "${SECRET_ANTHROPIC_API_KEY}"
  "${SECRET_RAZORPAY_KEY_ID}"
  "${SECRET_RAZORPAY_KEY_SECRET}"
)

for s in "${REQUIRED_SECRETS[@]}"; do
  if ! gcloud secrets describe "${s}" >/dev/null 2>&1; then
    echo "ERROR: Required secret not found: ${s}"
    exit 1
  fi
done

########################################
# ARTIFACT REGISTRY REPO
########################################
if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" >/dev/null 2>&1; then
  echo "==> Creating Artifact Registry repo: ${AR_REPO}"
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" >/dev/null
fi

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:${IMAGE_TAG}"

########################################
# BUILD CONTAINER
########################################
echo "==> Building image: ${IMAGE_URI}"
gcloud builds submit "${REPO_ROOT}/backend" --tag "${IMAGE_URI}"

########################################
# RUNTIME SERVICE ACCOUNT
########################################
if [[ -z "${RUNTIME_SA}" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi
echo "==> Runtime service account: ${RUNTIME_SA}"

########################################
# IAM BINDINGS FOR RUNTIME SA
########################################
echo "==> Granting IAM roles to runtime service account"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

########################################
# DEPLOY CLOUD RUN
########################################
AUTH_FLAG="--allow-unauthenticated"
if [[ "${ALLOW_UNAUTHENTICATED}" != "true" ]]; then
  AUTH_FLAG="--no-allow-unauthenticated"
fi

# Use custom delimiter to safely pass JSON arrays in env vars.
ENV_VARS="^@@^ENV=production@@ALLOW_MOCK_AUTH=false@@FRONTEND_URL=https://${APP_DOMAIN}@@PAYMENT_CALLBACK_URL=https://${APP_DOMAIN}/payment/success@@CORS_ORIGINS=[\"https://${APP_DOMAIN}\",\"https://${API_DOMAIN}\"]@@TRUSTED_HOSTS=[\"${API_DOMAIN}\",\"${APP_DOMAIN}\",\"localhost\",\"127.0.0.1\"]@@FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase/google-credentials.json"

OPTIONAL_SECRETS=""
if gcloud secrets describe "${SECRET_RAZORPAY_WEBHOOK_SECRET}" >/dev/null 2>&1; then
  OPTIONAL_SECRETS+=",RAZORPAY_WEBHOOK_SECRET=${SECRET_RAZORPAY_WEBHOOK_SECRET}:latest"
fi
if gcloud secrets describe "${SECRET_CRON_SECRET}" >/dev/null 2>&1; then
  OPTIONAL_SECRETS+=",CRON_SECRET=${SECRET_CRON_SECRET}:latest"
fi
if gcloud secrets describe "${SECRET_RESEND_API_KEY}" >/dev/null 2>&1; then
  OPTIONAL_SECRETS+=",RESEND_API_KEY=${SECRET_RESEND_API_KEY}:latest"
fi

SET_SECRETS="JWT_SECRET=${SECRET_JWT_SECRET}:latest,SSO_ENCRYPTION_KEY=${SECRET_SSO_ENCRYPTION_KEY}:latest,SSO_JWT_SECRET=${SECRET_SSO_JWT_SECRET}:latest,OPENAI_API_KEY=${SECRET_OPENAI_API_KEY}:latest,GEMINI_API_KEY=${SECRET_GEMINI_API_KEY}:latest,ANTHROPIC_API_KEY=${SECRET_ANTHROPIC_API_KEY}:latest,RAZORPAY_KEY_ID=${SECRET_RAZORPAY_KEY_ID}:latest,RAZORPAY_KEY_SECRET=${SECRET_RAZORPAY_KEY_SECRET}:latest,/secrets/firebase/google-credentials.json=firebase-admin-sdk-json:latest${OPTIONAL_SECRETS}"

echo "==> Deploying Cloud Run service"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_URI}" \
  --region "${REGION}" \
  --platform managed \
  ${AUTH_FLAG} \
  --service-account "${RUNTIME_SA}" \
  --port 8000 \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 40 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "${ENV_VARS}" \
  --set-secrets "${SET_SECRETS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
echo "==> Cloud Run URL: ${SERVICE_URL}"

########################################
# OPTIONAL: CREATE CRON JOB
########################################
if [[ "${CREATE_CRON_JOB}" == "true" ]]; then
  if gcloud secrets describe "${SECRET_CRON_SECRET}" >/dev/null 2>&1; then
    CRON_SECRET_VALUE="$(gcloud secrets versions access latest --secret="${SECRET_CRON_SECRET}")"
    if gcloud scheduler jobs describe aum-reset-quotas --location="${REGION}" >/dev/null 2>&1; then
      echo "==> Updating existing Cloud Scheduler job aum-reset-quotas"
      gcloud scheduler jobs update http aum-reset-quotas \
        --location="${REGION}" \
        --schedule="0 0 * * *" \
        --uri="${SERVICE_URL}/api/cron/reset-quotas" \
        --http-method=POST \
        --headers="Authorization=Bearer ${CRON_SECRET_VALUE}" >/dev/null
    else
      echo "==> Creating Cloud Scheduler job aum-reset-quotas"
      gcloud scheduler jobs create http aum-reset-quotas \
        --location="${REGION}" \
        --schedule="0 0 * * *" \
        --uri="${SERVICE_URL}/api/cron/reset-quotas" \
        --http-method=POST \
        --headers="Authorization=Bearer ${CRON_SECRET_VALUE}" >/dev/null
    fi
  else
    echo "WARN: ${SECRET_CRON_SECRET} not found. Skipping scheduler setup."
  fi
fi

########################################
# POST-DEPLOY CHECKS
########################################
echo "==> Post-deploy checks"
set +e
curl -sS "${SERVICE_URL}/api/health" | sed 's/.*/HEALTH: &/'
DOCS_STATUS="$(curl -o /dev/null -s -w "%{http_code}" "${SERVICE_URL}/api/docs")"
echo "DOCS_STATUS: ${DOCS_STATUS} (expected 404 in production)"
set -e

cat <<EOF

Deployment complete.

Next steps:
1) Map custom domain to Cloud Run:
   gcloud run domain-mappings create --service ${SERVICE_NAME} --domain ${API_DOMAIN} --region ${REGION}
2) Configure DNS records as prompted by GCP.
3) Set frontend NEXT_PUBLIC_API_BASE_URL=https://${API_DOMAIN}
4) Set Razorpay webhook URL: https://${API_DOMAIN}/api/payments/webhook
5) Set SSO callback URL: https://${API_DOMAIN}/api/sso/callback

EOF
