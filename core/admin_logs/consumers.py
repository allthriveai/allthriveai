"""
WebSocket Consumer for Admin Log Streaming

Provides real-time log streaming for admin dashboard with:
- Admin-only authentication
- Dynamic filtering
- History on connect
- Graceful disconnection
"""

import asyncio
import json
import logging
from datetime import datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .log_sources import LogFilters, get_log_source

logger = logging.getLogger(__name__)


class AdminLogConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for admin log streaming.

    Handles:
    - Admin authentication check
    - Real-time log streaming with filters
    - History on connect
    - Ping/pong heartbeat

    URL: ws/admin/logs/
    """

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user')

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'Admin logs WebSocket from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning('Unauthenticated admin logs WebSocket attempt')
            await self.close(code=4001)
            return

        # Check admin access
        if not getattr(self.user, 'is_admin_role', False):
            logger.warning(f'Non-admin user {self.user.id} attempted to access admin logs')
            await self.close(code=4003)
            return

        # Initialize state
        self.filters = LogFilters()
        self.streaming_task = None
        self.group_name = 'admin_logs'

        # Join admin logs group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(f'Admin logs WebSocket connected: user={self.user.id}')

        # Send history on connect
        try:
            source = get_log_source()
            history = await source.get_history(limit=100)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'history',
                        'logs': [log.to_camel_dict() for log in history],
                    }
                )
            )
        except PermissionError as e:
            # Docker socket permission issue - provide helpful message
            logger.error(f'Docker permission error: {e}')
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': 'Docker socket access denied. Log streaming unavailable in local dev.',
                    }
                )
            )
        except Exception as e:
            # Log full traceback for debugging
            import traceback

            logger.error(f'Error fetching log history: {type(e).__name__}: {e}')
            logger.error(traceback.format_exc())
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': 'Failed to initialize log streaming. Check server logs.',
                    }
                )
            )

        # Start log streaming
        self.streaming_task = asyncio.create_task(self._stream_logs())

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel streaming task to prevent memory leaks
        if hasattr(self, 'streaming_task') and self.streaming_task:
            self.streaming_task.cancel()
            try:
                await self.streaming_task
            except asyncio.CancelledError:
                pass

        # Leave group
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(
            f'Admin logs WebSocket disconnected: ' f'user={getattr(self.user, "id", "unknown")}, code={close_code}'
        )

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages from client."""
        try:
            data = json.loads(text_data)
            event_type = data.get('event') or data.get('type')

            # Heartbeat - always respond
            if event_type == 'ping':
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'pong',
                            'timestamp': datetime.now().isoformat(),
                        }
                    )
                )
                return

            # Update filters
            if event_type == 'updateFilters':
                filters_data = data.get('filters', {})
                self.filters = LogFilters.from_camel_dict(filters_data)
                logger.debug(f'Admin logs filters updated: {self.filters}')

                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'filtersUpdated',
                            'filters': filters_data,
                        }
                    )
                )
                return

            # Clear logs request (just acknowledge, frontend handles)
            if event_type == 'clearLogs':
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'logsCleared',
                        }
                    )
                )
                return

        except json.JSONDecodeError as e:
            logger.error(f'Invalid JSON received: {e}')
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': 'Invalid JSON format',
                    }
                )
            )
        except Exception as e:
            logger.error(f'Error processing message: {e}')
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': str(e),
                    }
                )
            )

    async def _stream_logs(self):
        """Stream logs from the appropriate source."""
        try:
            source = get_log_source()

            async for log in source.stream_logs():
                # Apply filters
                if not self.filters.matches(log):
                    continue

                # Send log to client
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'log',
                            'log': log.to_camel_dict(),
                        }
                    )
                )

        except asyncio.CancelledError:
            logger.debug('Log streaming task cancelled')
            raise
        except PermissionError as e:
            logger.error(f'Docker permission error in stream: {e}')
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': 'Docker socket access denied. Log streaming unavailable.',
                    }
                )
            )
        except Exception as e:
            # Sanitize error message to avoid leaking internal details
            logger.error(f'Error streaming logs: {e}')
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'message': 'Log streaming interrupted. Check server logs.',
                    }
                )
            )
