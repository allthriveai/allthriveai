#!/usr/bin/env python3
"""
WebSocket Test Script for AllThrive AI Chat

Tests WebSocket connection with JWT authentication:
1. Authenticates via REST API to get JWT token
2. Connects to WebSocket with token
3. Sends test message
4. Receives and displays streaming response
"""

import asyncio
import json
import sys
import urllib.parse

import requests
import websockets


class WebSocketTester:
    """Test WebSocket chat functionality with JWT authentication."""

    def __init__(self, backend_url: str, ws_url: str):
        self.backend_url = backend_url
        self.ws_url = ws_url
        self.access_token = None

    def authenticate(self, username: str, password: str):
        """
        Authenticate user and get JWT access token.

        Args:
            username: User's username
            password: User's password

        Returns:
            bool: True if authentication successful
        """
        print(f'\n🔐 Authenticating as {username}...')

        try:
            response = requests.post(
                f'{self.backend_url}/api/v1/auth/login/',
                json={'email': username, 'password': password},  # 'email' field accepts username too
                timeout=10,
            )

            if response.status_code == 200:
                # Try to get token from response JSON
                data = response.json()
                self.access_token = data.get('access_token')

                # Fallback: try to get from cookies
                if not self.access_token:
                    self.access_token = response.cookies.get('access_token')

                if self.access_token:
                    print(f'✅ Authentication successful! Token: {self.access_token[:20]}...')
                    return True
                else:
                    print('❌ No access token received in response')
                    print(f'Response: {data}')
                    return False
            else:
                print(f'❌ Authentication failed: {response.status_code}')
                print(f'Response: {response.text}')
                return False

        except Exception as e:
            print(f'❌ Authentication error: {e}')
            return False

    async def test_websocket(self, conversation_id='test-conversation'):
        """
        Test WebSocket connection and message streaming.

        Args:
            conversation_id: Conversation ID for WebSocket connection
        """
        if not self.access_token:
            print('❌ No access token available. Please authenticate first.')
            return

        # Build WebSocket URL with token as query parameter (fallback method)
        ws_endpoint = f'{self.ws_url}/ws/chat/{conversation_id}/?token={self.access_token}'

        print(f'\n🔌 Connecting to WebSocket: {ws_endpoint[:80]}...')

        # Add Origin header to pass AllowedHostsOriginValidator
        parsed_url = urllib.parse.urlparse(self.backend_url)
        origin = f'{parsed_url.scheme}://{parsed_url.netloc}'
        additional_headers = {
            'Origin': origin,
        }

        try:
            async with websockets.connect(ws_endpoint, additional_headers=additional_headers) as websocket:
                print('✅ WebSocket connected!')

                # Wait for connection confirmation
                response = await websocket.recv()
                data = json.loads(response)
                print(f'📨 Received: {data}')

                if data.get('event') == 'connected':
                    print(f'✅ Connection confirmed for conversation: {data.get("conversation_id")}')

                    # Send test message
                    test_message = 'Hello! This is a test message from the WebSocket test script.'
                    print(f'\n📤 Sending message: "{test_message}"')

                    await websocket.send(json.dumps({'message': test_message}))

                    # Receive streaming responses
                    print('\n📥 Receiving responses:')
                    while True:
                        try:
                            response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                            data = json.loads(response)
                            event = data.get('event')

                            if event == 'task_queued':
                                print(f'  ⏳ Task queued: {data.get("task_id")}')

                            elif event == 'processing_started':
                                print('  🔄 Processing started...')

                            elif event == 'chunk':
                                chunk = data.get('chunk', '')
                                print(f'  💬 Chunk: {chunk}', end='', flush=True)

                            elif event == 'completed':
                                print('\n  ✅ Processing completed!')
                                break

                            elif event == 'error':
                                print(f'\n  ❌ Error: {data.get("error")}')
                                break

                            else:
                                print(f'  ℹ️ Unknown event: {data}')

                        except TimeoutError:
                            print('\n⏱️ Timeout waiting for response')
                            break

                else:
                    print(f'❌ Unexpected connection response: {data}')

        except websockets.exceptions.InvalidStatusCode as e:
            print(f'❌ WebSocket connection failed with status {e.status_code}')
            if e.status_code == 403:
                print('   Authentication failed - invalid or expired token')
        except Exception as e:
            print(f'❌ WebSocket error: {e}')


def main():
    """Run WebSocket test."""
    print('=' * 60)
    print('AllThrive AI WebSocket Test Script')
    print('=' * 60)

    # Get credentials from command line or use defaults
    if len(sys.argv) >= 3:
        username = sys.argv[1]
        password = sys.argv[2]
    else:
        print('\nUsage: python test_websocket.py <username> <password>')
        print('Using default test credentials...\n')
        username = 'testuser'
        password = 'testpass123'

    # Get backend URL from environment or use default
    import os

    backend_host = os.getenv('BACKEND_HOST', 'localhost')
    backend_port = os.getenv('BACKEND_PORT', '8000')
    default_backend_url = f'http://{backend_host}:{backend_port}'
    default_ws_url = f'ws://{backend_host}:{backend_port}'

    backend_url = os.getenv('BACKEND_URL', default_backend_url)
    ws_url = os.getenv('WS_URL', default_ws_url)

    print(f'Backend URL: {backend_url}')
    print(f'WebSocket URL: {ws_url}')

    # Initialize tester
    tester = WebSocketTester(backend_url=backend_url, ws_url=ws_url)

    # Authenticate
    if not tester.authenticate(username, password):
        print('\n❌ Test failed: Authentication unsuccessful')
        sys.exit(1)

    # Test WebSocket
    try:
        asyncio.run(tester.test_websocket())
        print('\n' + '=' * 60)
        print('✅ WebSocket test completed!')
        print('=' * 60)
    except KeyboardInterrupt:
        print('\n⚠️ Test interrupted by user')
        sys.exit(0)


if __name__ == '__main__':
    main()
