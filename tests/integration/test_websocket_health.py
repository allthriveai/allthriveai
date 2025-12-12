"""
WebSocket Integration Tests

Tests that WebSocket connections work correctly in deployed environments.
These tests verify infrastructure configuration (CloudFront, ALB, Django)
to catch issues like SSL redirect misconfigurations.
"""

import asyncio
import json
import os

import pytest
import websockets


@pytest.mark.asyncio
@pytest.mark.integration
async def test_websocket_health_check():
    """
    Test WebSocket health check endpoint is accessible.

    This test verifies:
    - CloudFront routes /ws/* correctly
    - ALB forwards WebSocket upgrade requests
    - Django accepts WebSocket connections without 301 redirects
    - No SECURE_PROXY_SSL_HEADER misconfiguration
    """
    # Use environment variable for deployed URL
    base_url = os.getenv('API_URL').replace('http://', 'ws://').replace('https://', 'wss://')
    health_url = f'{base_url}/ws/health/'

    try:
        async with websockets.connect(health_url, open_timeout=5) as websocket:
            # Receive health check response
            response = await asyncio.wait_for(websocket.recv(), timeout=5)
            data = json.loads(response)

            assert data['status'] == 'ok'
            assert 'message' in data
            print(f"✅ WebSocket health check passed: {data['message']}")

    except websockets.exceptions.InvalidStatusCode as e:
        if e.status_code == 301:
            pytest.fail(
                f'WebSocket connection failed with 301 redirect!\n'
                f'This indicates SECURE_PROXY_SSL_HEADER misconfiguration.\n'
                f'Check that Django settings use HTTP_X_FORWARDED_PROTO, not HTTP_CLOUDFRONT_FORWARDED_PROTO.\n'
                f'URL: {health_url}'
            )
        else:
            pytest.fail(f'WebSocket connection failed with status {e.status_code}: {e}')
    except TimeoutError:
        pytest.fail(f'WebSocket health check timed out. URL: {health_url}')
    except Exception as e:
        pytest.fail(f'WebSocket connection failed: {e}')


@pytest.mark.asyncio
@pytest.mark.integration
async def test_websocket_ssl_redirect_not_triggered():
    """
    Test that WebSocket connections don't trigger SSL redirects.

    This is a regression test for the SECURE_PROXY_SSL_HEADER misconfiguration
    that caused 301 redirects on WebSocket upgrade requests.
    """
    base_url = os.getenv('API_URL').replace('http://', 'ws://').replace('https://', 'wss://')
    health_url = f'{base_url}/ws/health/'

    try:
        # This should connect successfully without any redirects
        async with websockets.connect(health_url, open_timeout=5, max_redirects=0) as websocket:
            response = await asyncio.wait_for(websocket.recv(), timeout=5)
            assert response  # Any response means connection succeeded
            print('✅ WebSocket connected without redirects')

    except websockets.exceptions.InvalidStatusCode as e:
        if e.status_code in [301, 302, 303, 307, 308]:
            pytest.fail(
                f"❌ CRITICAL: WebSocket connection triggered {e.status_code} redirect!\n"
                f"\n"
                f"This will break all WebSocket connections in production.\n"
                f"\n"
                f"Root cause: SECURE_PROXY_SSL_HEADER misconfiguration\n"
                f"Solution: Ensure Django settings use HTTP_X_FORWARDED_PROTO\n"
                f"\n"
                f"URL: {health_url}\n"
                f"Redirect location: {e.headers.get('Location', 'unknown')}"
            )
        raise


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skipif(
    not os.getenv('API_URL') or 'localhost' in os.getenv('API_URL', ''),
    reason='Production URL not set - run with API_URL=https://api.allthrive.ai',
)
async def test_websocket_production_infrastructure():
    """
    Test WebSocket connection through full production stack.

    This test verifies the entire path:
    CloudFront → ALB → ECS/Django

    Only runs when API_URL is set to production URL.
    """
    api_url = os.getenv('API_URL')
    ws_url = api_url.replace('https://', 'wss://').replace('http://', 'ws://')
    health_url = f'{ws_url}/ws/health/'

    print(f'Testing production WebSocket: {health_url}')

    try:
        async with websockets.connect(health_url, open_timeout=10) as websocket:
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            data = json.loads(response)

            assert data['status'] == 'ok'
            print(f"✅ Production WebSocket infrastructure working: {data['message']}")

    except Exception as e:
        pytest.fail(
            f'❌ Production WebSocket test failed!\n'
            f'\n'
            f'URL: {health_url}\n'
            f'Error: {e}\n'
            f'\n'
            f'Check AWS logs:\n'
            f'  aws logs tail /ecs/production-allthrive-web --region us-east-1 --follow\n'
        )
