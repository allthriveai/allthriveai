#!/bin/bash
# Helper script to run raw Python code on AWS ECS via Django shell

set -e

ENVIRONMENT=${ENVIRONMENT:-production}
AWS_REGION=${AWS_REGION:-us-east-1}

if [ -z "$1" ]; then
    echo "❌ Error: Python code is required"
    echo "Usage: ./scripts/aws-run-python.sh 'print(1+1)'"
    exit 1
fi

PYTHON_CODE="$1"

echo "=== Running Python on AWS ECS ==="
echo "Environment: $ENVIRONMENT"
echo "Code: $PYTHON_CODE"
echo ""

# Get task definition from running service
TASK_DEF=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --region $AWS_REGION \
    --query 'services[0].taskDefinition' \
    --output text 2>/dev/null)

if [ -z "$TASK_DEF" ] || [ "$TASK_DEF" = "None" ]; then
    echo "❌ Error: Could not find task definition"
    exit 1
fi

echo "Task Definition: $TASK_DEF"

# Get network configuration from running service
SUBNETS=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --region $AWS_REGION \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
    --output text 2>/dev/null | tr '\t' ',')

SECURITY_GROUPS=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --region $AWS_REGION \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \
    --output text 2>/dev/null | tr '\t' ',')

ASSIGN_PUBLIC_IP=$(aws ecs describe-services \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --services ${ENVIRONMENT}-allthrive-web \
    --region $AWS_REGION \
    --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' \
    --output text 2>/dev/null)

echo "Subnets: $SUBNETS"
echo "Security Groups: $SECURITY_GROUPS"
echo ""

# Build JSON with the command: python manage.py shell -c "<code>"
OVERRIDES=$(python3 << PYEOF
import json
code = '''$PYTHON_CODE'''
override = {
    'containerOverrides': [{
        'name': 'web',
        'command': ['python', 'manage.py', 'shell', '-c', code]
    }]
}
print(json.dumps(override))
PYEOF
)

echo "Starting one-off task..."
TASK_ARN=$(aws ecs run-task \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --task-definition $TASK_DEF \
    --launch-type FARGATE \
    --region $AWS_REGION \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=$ASSIGN_PUBLIC_IP}" \
    --overrides "$OVERRIDES" \
    --query 'tasks[0].taskArn' \
    --output text)

echo "✓ Task started: $TASK_ARN"
echo ""
echo "Waiting for task to complete..."

aws ecs wait tasks-stopped \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --tasks $TASK_ARN \
    --region $AWS_REGION

EXIT_CODE=$(aws ecs describe-tasks \
    --cluster ${ENVIRONMENT}-allthrive-cluster \
    --tasks $TASK_ARN \
    --region $AWS_REGION \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)

if [ "$EXIT_CODE" = "0" ]; then
    echo "✓ Command completed successfully"
else
    echo "❌ Command failed with exit code: $EXIT_CODE"
    echo "Check CloudWatch logs for details"
    exit 1
fi
