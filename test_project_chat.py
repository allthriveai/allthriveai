#!/usr/bin/env python
"""
Test script for project creation chat flow.
Tests the streaming API and Redis state persistence.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/app')
django.setup()

# Add testserver to ALLOWED_HOSTS
from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

import json
import uuid
from django.test import Client
from core.models import User, Project

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log(message, color=RESET):
    print(f"{color}{message}{RESET}")

def parse_streaming_response(response):
    """Parse streaming response and extract tokens and metadata."""
    content = b''.join(response.streaming_content).decode()
    lines = content.split('\n')
    
    full_response = ""
    step = None
    session_id = None
    project_id = None
    project_slug = None
    
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
                elif data.get('type') == 'complete':
                    step = data.get('step')
                    session_id = data.get('session_id')
                    project_id = data.get('project_id')
                    project_slug = data.get('project_slug')
            except json.JSONDecodeError:
                pass
    
    return full_response.strip(), step, session_id, project_id, project_slug

def test_project_chat():
    """Test the complete project creation chat flow."""
    log("\n=== Testing Project Creation Chat Flow ===\n", BLUE)
    
    # Get test user
    try:
        user = User.objects.get(username='testuser')
        log(f"✓ Using test user: {user.username} (ID: {user.id})", GREEN)
    except User.DoesNotExist:
        log("✗ Test user not found", RED)
        return False
    
    # Create authenticated client
    client = Client()
    client.force_login(user)
    log("✓ Client authenticated", GREEN)
    
    # Generate session ID
    session_id = str(uuid.uuid4())
    log(f"✓ Generated session ID: {session_id}", GREEN)
    
    # Test 1: Start chat with project title
    log("\n--- Test 1: Start chat with project title ---", BLUE)
    response = client.post(
        '/api/v1/project/chat/stream/',
        data=json.dumps({
            'session_id': session_id,
            'action': 'start',
            'message': 'My AI Art Gallery'
        }),
        content_type='application/json'
    )
    
    if response.status_code != 200:
        log(f"✗ Failed to start chat: {response.status_code}", RED)
        log(f"Response: {response.content.decode()}", RED)
        return False
    
    log(f"✓ Chat started (status: {response.status_code})", GREEN)
    
    # Parse streaming response
    content = b''.join(response.streaming_content).decode()
    lines = content.split('\n')
    
    full_response = ""
    step = None
    
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
                elif data.get('type') == 'complete':
                    step = data.get('step')
                    session_id = data.get('session_id')
                    log(f"✓ Step completed: {step}", GREEN)
            except json.JSONDecodeError:
                pass
    
    log(f"Response: {full_response.strip()}", BLUE)
    
    if "description" not in full_response.lower():
        log("✗ Expected to be asked for description", RED)
        return False
    
    log("✓ Correctly asked for description", GREEN)
    
    # Test 2: Submit description
    log("\n--- Test 2: Submit description ---", BLUE)
    response = client.post(
        '/api/v1/project/chat/stream/',
        data=json.dumps({
            'session_id': session_id,
            'action': 'submit',
            'message': 'A collection of AI-generated artwork exploring digital creativity'
        }),
        content_type='application/json'
    )
    
    if response.status_code != 200:
        log(f"✗ Failed to submit description: {response.status_code}", RED)
        return False
    
    content = response.content.decode()
    lines = content.split('\n')
    
    full_response = ""
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
                elif data.get('type') == 'complete':
                    step = data.get('step')
            except json.JSONDecodeError:
                pass
    
    log(f"Response: {full_response.strip()}", BLUE)
    
    if "type" not in full_response.lower():
        log("✗ Expected to be asked for project type", RED)
        return False
    
    log("✓ Correctly asked for project type", GREEN)
    
    # Test 3: Submit type
    log("\n--- Test 3: Submit type ---", BLUE)
    response = client.post(
        '/api/v1/project/chat/stream/',
        data=json.dumps({
            'session_id': session_id,
            'action': 'submit',
            'message': '2'  # Image collection
        }),
        content_type='application/json'
    )
    
    if response.status_code != 200:
        log(f"✗ Failed to submit type: {response.status_code}", RED)
        return False
    
    content = response.content.decode()
    lines = content.split('\n')
    
    full_response = ""
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
            except json.JSONDecodeError:
                pass
    
    log(f"Response: {full_response.strip()}", BLUE)
    log("✓ Type submitted successfully", GREEN)
    
    # Test 4: Submit showcase preference
    log("\n--- Test 4: Submit showcase preference ---", BLUE)
    response = client.post(
        '/api/v1/project/chat/stream/',
        data=json.dumps({
            'session_id': session_id,
            'action': 'submit',
            'message': 'yes'
        }),
        content_type='application/json'
    )
    
    if response.status_code != 200:
        log(f"✗ Failed to submit showcase: {response.status_code}", RED)
        return False
    
    content = response.content.decode()
    lines = content.split('\n')
    
    full_response = ""
    project_id = None
    project_slug = None
    
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
                elif data.get('type') == 'complete':
                    project_id = data.get('project_id')
                    project_slug = data.get('project_slug')
            except json.JSONDecodeError:
                pass
    
    log(f"Response: {full_response.strip()}", BLUE)
    
    # Test 5: Confirm and create project
    log("\n--- Test 5: Confirm and create project ---", BLUE)
    response = client.post(
        '/api/v1/project/chat/stream/',
        data=json.dumps({
            'session_id': session_id,
            'action': 'submit',
            'message': 'yes'
        }),
        content_type='application/json'
    )
    
    if response.status_code != 200:
        log(f"✗ Failed to create project: {response.status_code}", RED)
        return False
    
    content = response.content.decode()
    lines = content.split('\n')
    
    full_response = ""
    for line in lines:
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                if data.get('type') == 'token':
                    full_response += data.get('content', '')
                elif data.get('type') == 'complete':
                    project_id = data.get('project_id')
                    project_slug = data.get('project_slug')
            except json.JSONDecodeError:
                pass
    
    log(f"Response: {full_response.strip()}", BLUE)
    
    if project_id:
        log(f"✓ Project created! ID: {project_id}, Slug: {project_slug}", GREEN)
        
        # Verify project in database
        try:
            project = Project.objects.get(id=project_id, user=user)
            log(f"✓ Project verified in database:", GREEN)
            log(f"  - Title: {project.title}", GREEN)
            log(f"  - Slug: {project.slug}", GREEN)
            log(f"  - Type: {project.project_type}", GREEN)
            log(f"  - Showcase: {project.is_showcase}", GREEN)
        except Project.DoesNotExist:
            log(f"✗ Project not found in database", RED)
            return False
    else:
        log("✗ No project ID returned", RED)
        return False
    
    log("\n=== All tests passed! ===\n", GREEN)
    return True

if __name__ == '__main__':
    success = test_project_chat()
    sys.exit(0 if success else 1)
