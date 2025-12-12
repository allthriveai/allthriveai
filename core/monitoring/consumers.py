"""
WebSocket Health Check Consumer

Provides a simple WebSocket endpoint for health monitoring.
Can be used by ALB health checks, monitoring systems, or automated tests
to verify WebSocket infrastructure is working correctly.
"""

import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class HealthCheckConsumer(AsyncWebsocketConsumer):
    """
    WebSocket health check endpoint.

    Accepts connections, sends a pong response, and closes.
    No authentication required - this is for infrastructure monitoring.

    Usage:
        ws = new WebSocket('wss://api.allthrive.ai/ws/health/')
        ws.onmessage = (e) => console.log(e.data)  // {"status":"ok","message":"WebSocket healthy"}
    """

    async def connect(self):
        """Accept WebSocket connection for health check."""
        await self.accept()
        logger.debug('[WS_HEALTH] Health check connection accepted')

        # Send health status
        await self.send(text_data='{"status":"ok","message":"WebSocket healthy"}')

        # Close connection after health check
        await self.close(code=1000)
        logger.debug('[WS_HEALTH] Health check completed, connection closed')

    async def disconnect(self, close_code):
        """Handle disconnection."""
        logger.debug(f'[WS_HEALTH] Health check disconnected: code={close_code}')

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming messages (echo back for testing).

        This allows more complex health checks if needed.
        """
        if text_data:
            await self.send(text_data=text_data)
