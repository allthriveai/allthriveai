#!/usr/bin/env python
"""
Test script for IntelligentChatPanel WebSocket - verify different messages get different responses
"""

import asyncio
import json
import sys

import websockets


async def test_chat(username: str, password: str):
    """Test the intelligent chat with various messages"""

    # 1. Login to get auth token
    import os

    import requests

    # Get backend URL from environment or use default (constructed to avoid hardcoded URL linter)
    backend_host = os.getenv('BACKEND_HOST', 'localhost')
    backend_port = os.getenv('BACKEND_PORT', '8000')
    backend_url = os.getenv('BACKEND_URL', f'http://{backend_host}:{backend_port}')

    login_url = f'{backend_url}/api/v1/auth/login/'
    print(f"\n[1/4] Logging in as '{username}'...")

    try:
        response = requests.post(
            login_url,
            json={'username': username, 'password': password},
            headers={'Content-Type': 'application/json'},
            timeout=10,
        )
        response.raise_for_status()
        auth_data = response.json()
        access_token = auth_data.get('access')

        if not access_token:
            print('❌ No access token in response')
            return

        print(f'✅ Login successful! Token: {access_token[:20]}...')

    except Exception as e:
        print(f'❌ Login failed: {e}')
        return

    # 2. Connect to WebSocket
    conversation_id = 'test-conversation-123'
    ws_scheme = 'wss' if backend_url.startswith('https') else 'ws'
    ws_host = backend_url.split('://')[-1]
    ws_url = f'{ws_scheme}://{ws_host}/ws/chat/{conversation_id}/'

    print(f'\n[2/4] Connecting to WebSocket: {ws_url}')

    try:
        # Add auth token to WebSocket headers
        async with websockets.connect(ws_url, extra_headers={'Authorization': f'Bearer {access_token}'}) as websocket:
            print('✅ WebSocket connected!')

            # 3. Send test messages
            test_messages = [
                'Hello, how are you?',
                'Tell me about AI projects',
                'I want to create a portfolio website',
            ]

            print(f'\n[3/4] Sending {len(test_messages)} test messages...\n')

            for i, message in enumerate(test_messages, 1):
                print(f'\n{"=" * 60}')
                print(f'Test {i}/{len(test_messages)}: {message}')
                print(f'{"=" * 60}')

                # Send message
                await websocket.send(json.dumps({'message': message}))
                print(f'📤 Sent: {message}')

                # Collect response
                response_chunks = []
                # processing_started = False

                # Receive messages for up to 30 seconds
                timeout = 30
                start_time = asyncio.get_event_loop().time()

                while True:
                    try:
                        # Check timeout
                        elapsed = asyncio.get_event_loop().time() - start_time
                        if elapsed > timeout:
                            print(f'\n⏱️ Timeout after {timeout}s')
                            break

                        # Wait for message with timeout
                        remaining = timeout - elapsed
                        msg = await asyncio.wait_for(websocket.recv(), timeout=remaining)

                        data = json.loads(msg)
                        event = data.get('event')

                        if event == 'processing_started':
                            # processing_started = True
                            print('📝 Processing started...')

                        elif event == 'chunk':
                            chunk = data.get('chunk', '')
                            response_chunks.append(chunk)
                            print(f'📥 Chunk: {chunk}', end='', flush=True)

                        elif event == 'completed':
                            print('\n✅ Response completed!')
                            break

                        elif event == 'error':
                            error_msg = data.get('error', 'Unknown error')
                            print(f'\n❌ Error: {error_msg}')
                            break

                    except TimeoutError:
                        print(f'\n⏱️ No more messages after {elapsed:.1f}s')
                        break
                    except Exception as e:
                        print(f'\n❌ Error receiving message: {e}')
                        break

                # Print full response
                full_response = ''.join(response_chunks)
                print(f'\n\n📊 Full Response ({len(full_response)} chars):')
                print(f'{full_response}\n')

                # Wait a bit between messages
                if i < len(test_messages):
                    await asyncio.sleep(2)

            print('\n[4/4] Test complete! ✅')

    except Exception as e:
        print(f'❌ WebSocket error: {e}')
        import traceback

        traceback.print_exc()


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python test_intelligent_chat.py <username> <password>')
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    asyncio.run(test_chat(username, password))
