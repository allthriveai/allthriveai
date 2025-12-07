#!/bin/bash
set -e

# AllThrive AI - CloudFormation Deployment Script
# ================================================
# This script deploys all CloudFormation stacks in the correct order.

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
STACK_PREFIX="${ENVIRONMENT}-allthrive"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
}

# Check AWS credentials
check_aws_credentials() {
    log_info "Checking AWS credentials..."
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_success "Authenticated as account: $ACCOUNT_ID"
}

# Deploy a single stack
deploy_stack() {
    local stack_name=$1
    local template_file=$2
    local parameters=$3

    log_info "Deploying stack: $stack_name"

    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$stack_name" --region "$REGION" &> /dev/null; then
        log_info "Stack exists, updating..."
        aws cloudformation update-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION" 2>/dev/null || {
                if [[ $? -eq 255 ]]; then
                    log_warning "No updates to perform for $stack_name"
                    return 0
                fi
            }
    else
        log_info "Creating new stack..."
        aws cloudformation create-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION"
    fi

    # Wait for stack operation to complete
    log_info "Waiting for stack operation to complete..."
    aws cloudformation wait stack-create-complete --stack-name "$stack_name" --region "$REGION" 2>/dev/null || \
    aws cloudformation wait stack-update-complete --stack-name "$stack_name" --region "$REGION" 2>/dev/null || true

    # Check stack status
    STATUS=$(aws cloudformation describe-stacks --stack-name "$stack_name" --region "$REGION" --query 'Stacks[0].StackStatus' --output text)
    if [[ "$STATUS" == *"COMPLETE"* ]] && [[ "$STATUS" != *"ROLLBACK"* ]]; then
        log_success "Stack $stack_name deployed successfully (Status: $STATUS)"
    else
        log_error "Stack $stack_name deployment failed (Status: $STATUS)"
        exit 1
    fi
}

# Main deployment function
deploy_all() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    log_info "Starting deployment for environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    echo ""

    # Phase 1: VPC
    log_info "=== Phase 1: VPC ==="
    deploy_stack "${STACK_PREFIX}-vpc" \
        "$script_dir/01-vpc.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 2: Security Groups
    log_info "=== Phase 2: Security Groups ==="
    deploy_stack "${STACK_PREFIX}-security-groups" \
        "$script_dir/02-security-groups.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 3: Data Layer (parallel deployment possible)
    log_info "=== Phase 3: Data Layer ==="

    # RDS
    deploy_stack "${STACK_PREFIX}-rds" \
        "$script_dir/03-rds.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT ParameterKey=MultiAZ,ParameterValue=true"

    # ElastiCache
    deploy_stack "${STACK_PREFIX}-elasticache" \
        "$script_dir/04-elasticache.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # S3
    deploy_stack "${STACK_PREFIX}-s3" \
        "$script_dir/05-s3.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 4: ECR
    log_info "=== Phase 4: ECR ==="
    deploy_stack "${STACK_PREFIX}-ecr" \
        "$script_dir/06-ecr.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 5: IAM
    log_info "=== Phase 5: IAM ==="
    deploy_stack "${STACK_PREFIX}-iam" \
        "$script_dir/07-iam.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 6: Secrets
    log_info "=== Phase 6: Secrets ==="
    deploy_stack "${STACK_PREFIX}-secrets" \
        "$script_dir/08-secrets.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    # Phase 7: ALB
    log_info "=== Phase 7: ALB ==="
    deploy_stack "${STACK_PREFIX}-alb" \
        "$script_dir/09-alb.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    log_success "=== Infrastructure deployment complete ==="
    echo ""
    log_warning "NEXT STEPS:"
    echo "1. Update secrets in AWS Secrets Manager with real values"
    echo "2. Build and push Docker images to ECR"
    echo "3. Deploy ECS services (run: ./deploy.sh ecs)"
    echo "4. Deploy CloudFront (run: ./deploy.sh cloudfront)"
    echo ""
}

# Deploy ECS only (after images are pushed)
deploy_ecs() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    log_info "Deploying ECS services..."

    # Get ECR repository URI
    ECR_URI=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-ecr" \
        --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' \
        --output text --region "$REGION")

    if [[ -z "$ECR_URI" ]]; then
        log_error "Could not find ECR repository. Deploy infrastructure first."
        exit 1
    fi

    log_info "Using ECR Repository: $ECR_URI"

    deploy_stack "${STACK_PREFIX}-ecs" \
        "$script_dir/10-ecs.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT ParameterKey=BackendImageTag,ParameterValue=latest"

    log_success "ECS deployment complete"
}

# Deploy CloudFront only
deploy_cloudfront() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local domain_name="${DOMAIN_NAME:-}"
    local cert_arn="${CERTIFICATE_ARN:-}"

    log_info "Deploying CloudFront distribution..."

    local params="ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"

    if [[ -n "$domain_name" ]]; then
        params="$params ParameterKey=DomainName,ParameterValue=$domain_name"
    fi

    if [[ -n "$cert_arn" ]]; then
        params="$params ParameterKey=CertificateArn,ParameterValue=$cert_arn"
    fi

    deploy_stack "${STACK_PREFIX}-cloudfront" \
        "$script_dir/11-cloudfront.yaml" \
        "$params"

    # Get CloudFront URL
    CF_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-cloudfront" \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
        --output text --region "$REGION")

    log_success "CloudFront deployment complete"
    log_info "CloudFront URL: $CF_URL"
}

# Delete all stacks
delete_all() {
    log_warning "This will delete ALL AllThrive AI infrastructure!"
    read -p "Are you sure? (type 'yes' to confirm): " confirm

    if [[ "$confirm" != "yes" ]]; then
        log_info "Deletion cancelled"
        exit 0
    fi

    local stacks=(
        "${STACK_PREFIX}-cloudfront"
        "${STACK_PREFIX}-ecs"
        "${STACK_PREFIX}-alb"
        "${STACK_PREFIX}-secrets"
        "${STACK_PREFIX}-iam"
        "${STACK_PREFIX}-ecr"
        "${STACK_PREFIX}-s3"
        "${STACK_PREFIX}-elasticache"
        "${STACK_PREFIX}-rds"
        "${STACK_PREFIX}-security-groups"
        "${STACK_PREFIX}-vpc"
    )

    for stack in "${stacks[@]}"; do
        if aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &> /dev/null; then
            log_info "Deleting stack: $stack"
            aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
            aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$REGION"
            log_success "Deleted: $stack"
        else
            log_warning "Stack not found: $stack"
        fi
    done

    log_success "All stacks deleted"
}

# Show stack outputs
show_outputs() {
    log_info "Fetching stack outputs..."
    echo ""

    local stacks=(
        "${STACK_PREFIX}-vpc"
        "${STACK_PREFIX}-rds"
        "${STACK_PREFIX}-elasticache"
        "${STACK_PREFIX}-s3"
        "${STACK_PREFIX}-ecr"
        "${STACK_PREFIX}-alb"
        "${STACK_PREFIX}-ecs"
        "${STACK_PREFIX}-cloudfront"
    )

    for stack in "${stacks[@]}"; do
        if aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &> /dev/null; then
            echo -e "${BLUE}=== $stack ===${NC}"
            aws cloudformation describe-stacks \
                --stack-name "$stack" \
                --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
                --output table --region "$REGION" 2>/dev/null || echo "No outputs"
            echo ""
        fi
    done
}

# Print usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all         Deploy all infrastructure (default)"
    echo "  ecs         Deploy ECS services only"
    echo "  cloudfront  Deploy CloudFront only"
    echo "  outputs     Show all stack outputs"
    echo "  delete      Delete all stacks"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT      Environment name (default: production)"
    echo "  AWS_REGION       AWS region (default: us-east-1)"
    echo "  DOMAIN_NAME      Custom domain for CloudFront"
    echo "  CERTIFICATE_ARN  ACM certificate ARN for HTTPS"
    echo ""
    echo "Examples:"
    echo "  ENVIRONMENT=staging ./deploy.sh all"
    echo "  DOMAIN_NAME=allthrive.ai CERTIFICATE_ARN=arn:aws:acm:... ./deploy.sh cloudfront"
}

# Main
check_aws_cli
check_aws_credentials

case "${1:-all}" in
    all)
        deploy_all
        ;;
    ecs)
        deploy_ecs
        ;;
    cloudfront)
        deploy_cloudfront
        ;;
    outputs)
        show_outputs
        ;;
    delete)
        delete_all
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
