#!/bin/bash
# Pull production database to local Docker
#
# Prerequisites:
# 1. AWS CLI configured with appropriate credentials
# 2. Docker running with local PostgreSQL container
#
# Required AWS Permissions for ECS Task Role:
# Add this policy to allow S3 uploads:
#   {
#     "Effect": "Allow",
#     "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
#     "Resource": "arn:aws:s3:::allthrive-backups-*-*/db-dumps/*"
#   }
#
# Note: If RDS PostgreSQL version > pg_dump version, you may need to
# update the Docker image to include a newer PostgreSQL client.

set -e

ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Get AWS account ID - fail explicitly if credentials are misconfigured
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Error: Could not determine AWS account ID. Check your AWS credentials."
    exit 1
fi

S3_BUCKET="allthrive-backups-${ENVIRONMENT}-${AWS_ACCOUNT_ID}"
DUMP_FILE="db-dump-$(date +%Y%m%d-%H%M%S).sql.gz"
S3_KEY="db-dumps/${DUMP_FILE}"
LOCAL_DUMP="/tmp/${DUMP_FILE}"

echo "=== Pull Production Database to Local ==="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "AWS Region: ${AWS_REGION}"
echo ""

# Get the task definition for the web service
echo "Getting ECS task definition..."
TASK_DEF=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --query 'services[0].taskDefinition' \
    --output text \
    --region ${AWS_REGION})

if [ -z "$TASK_DEF" ] || [ "$TASK_DEF" = "None" ]; then
    echo "Error: Could not find task definition"
    exit 1
fi

echo "Task definition: ${TASK_DEF}"

# Get network configuration from the service as JSON
echo "Getting network configuration..."
SUBNETS_JSON=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
    --output json \
    --region ${AWS_REGION})

SECURITY_GROUPS_JSON=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \
    --output json \
    --region ${AWS_REGION})

echo "Subnets: ${SUBNETS_JSON}"
echo "Security Groups: ${SECURITY_GROUPS_JSON}"

# Create temp files for JSON configs
NETWORK_CONFIG_FILE=$(mktemp)
OVERRIDES_FILE=$(mktemp)

# Ensure temp files are cleaned up on exit (success or failure)
trap 'rm -f "${NETWORK_CONFIG_FILE}" "${OVERRIDES_FILE}"' EXIT

# Write network configuration
cat > "${NETWORK_CONFIG_FILE}" << EOF
{
  "awsvpcConfiguration": {
    "subnets": ${SUBNETS_JSON},
    "securityGroups": ${SECURITY_GROUPS_JSON},
    "assignPublicIp": "ENABLED"
  }
}
EOF

# Write overrides - the command uses Python to parse DATABASE_URL (handles special chars in password)
cat > "${OVERRIDES_FILE}" << EOF
{
  "containerOverrides": [
    {
      "name": "web",
      "command": [
        "sh", "-c",
        "set -e && echo 'Parsing DATABASE_URL with Python...' && eval \$(python3 -c 'import os, shlex; from urllib.parse import urlparse, unquote; u=urlparse(os.environ[\"DATABASE_URL\"]); print(f\"DB_HOST={u.hostname}\"); print(f\"DB_PORT={u.port or 5432}\"); print(f\"DB_USER={u.username}\"); print(f\"DB_PASS={shlex.quote(unquote(u.password))}\"); print(f\"DB_NAME={u.path[1:]}\" if u.path else \"DB_NAME=\")') && echo \"Dumping from \$DB_HOST:\$DB_PORT/\$DB_NAME...\" && export PGPASSWORD=\"\$DB_PASS\" && pg_dump -h \$DB_HOST -p \$DB_PORT -U \$DB_USER -d \$DB_NAME --no-owner --no-acl | gzip > /tmp/dump.sql.gz && echo 'Uploading to S3...' && aws s3 cp /tmp/dump.sql.gz s3://${S3_BUCKET}/${S3_KEY} && echo 'Done!'"
      ]
    }
  ]
}
EOF

echo ""
echo "Starting ECS task to dump database..."

# Run the ECS task using file:// for JSON inputs
TASK_ARN=$(aws ecs run-task \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --task-definition ${TASK_DEF} \
    --launch-type FARGATE \
    --network-configuration "file://${NETWORK_CONFIG_FILE}" \
    --overrides "file://${OVERRIDES_FILE}" \
    --query 'tasks[0].taskArn' \
    --output text \
    --region ${AWS_REGION})

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
    echo "Error: Failed to start ECS task"
    exit 1
fi

TASK_ID=$(echo $TASK_ARN | rev | cut -d'/' -f1 | rev)
echo "Task started: ${TASK_ID}"
echo ""
echo "Waiting for task to complete (this may take a few minutes)..."

# Wait for task to complete
aws ecs wait tasks-stopped \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --tasks ${TASK_ARN} \
    --region ${AWS_REGION}

# Check exit code
EXIT_CODE=$(aws ecs describe-tasks \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --tasks ${TASK_ARN} \
    --query 'tasks[0].containers[?name==`web`].exitCode' \
    --output text \
    --region ${AWS_REGION})

if [ "$EXIT_CODE" != "0" ]; then
    echo ""
    echo "Error: ECS task failed with exit code ${EXIT_CODE}"
    echo "Check CloudWatch logs: /ecs/${ENVIRONMENT}-allthrive-web"
    exit 1
fi

echo "ECS task completed successfully"
echo ""

# Download from S3
echo "Downloading dump from S3..."
aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${LOCAL_DUMP}" --region ${AWS_REGION}

if [ ! -f "${LOCAL_DUMP}" ]; then
    echo "Error: Failed to download dump file"
    exit 1
fi

DUMP_SIZE=$(du -h "${LOCAL_DUMP}" | cut -f1)
echo "Downloaded: ${LOCAL_DUMP} (${DUMP_SIZE})"
echo ""

# Clean up S3
echo "Cleaning up S3..."
aws s3 rm "s3://${S3_BUCKET}/${S3_KEY}" --region ${AWS_REGION}

# Restore to local Docker
echo "Restoring to local Docker PostgreSQL..."
echo ""

# Verify local Docker is running
if ! docker-compose ps db 2>/dev/null | grep -q "Up"; then
    echo "Error: Local database container is not running. Run 'make up' first."
    exit 1
fi

# Drop and recreate the database
docker-compose exec -T db psql -U ${POSTGRES_USER:-allthrive} -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-allthrive_ai};"
docker-compose exec -T db psql -U ${POSTGRES_USER:-allthrive} -d postgres -c "CREATE DATABASE ${POSTGRES_DB:-allthrive_ai};"

# Restore the dump (gunzip and pipe to psql)
gunzip -c "${LOCAL_DUMP}" | docker-compose exec -T db psql -U ${POSTGRES_USER:-allthrive} -d ${POSTGRES_DB:-allthrive_ai}

echo ""
echo "Running migrations to ensure schema is up to date..."
docker-compose exec -T web python manage.py migrate --noinput

# Clean up local dump file
rm -f "${LOCAL_DUMP}"

# Load configuration for preserved usernames
CONFIG_FILE=".pull-prod-db.conf"
PRESERVE_USERNAMES=""

if [ -f "${CONFIG_FILE}" ]; then
    source "${CONFIG_FILE}"
fi

# Prompt for username to preserve if not configured
if [ -z "${PRESERVE_USERNAMES}" ]; then
    echo ""
    read -p "Enter your username to preserve (for OAuth login), or press Enter to skip: " USERNAME_INPUT
    if [ -n "${USERNAME_INPUT}" ]; then
        PRESERVE_USERNAMES="${USERNAME_INPUT}"
        echo "PRESERVE_USERNAMES=\"${USERNAME_INPUT}\"" > "${CONFIG_FILE}"
        echo "Saved to ${CONFIG_FILE} for future runs."
    fi
fi

# Anonymize user data for local development
echo ""
echo "Anonymizing user data for local development..."

ANONYMIZE_ARGS="--confirm --preserve-staff --preserve-agents"
if [ -n "${PRESERVE_USERNAMES}" ]; then
    # Support multiple usernames separated by comma
    IFS=',' read -ra USERNAMES <<< "${PRESERVE_USERNAMES}"
    for username in "${USERNAMES[@]}"; do
        ANONYMIZE_ARGS="${ANONYMIZE_ARGS} --preserve-username=${username}"
    done
fi

docker-compose exec -T web python manage.py anonymize_users ${ANONYMIZE_ARGS}

echo ""
echo "=== Database Pull Complete ==="
echo ""
echo "Your local database now contains ${ENVIRONMENT} data."
echo "User PII has been anonymized (except preserved accounts)."
echo ""
echo "IMPORTANT: Remember to restart your services:"
echo "  make restart"
echo ""
