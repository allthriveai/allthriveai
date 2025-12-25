"""
Log Sources for Admin Log Streaming

Provides unified interface for streaming logs from:
- Docker containers (local development)
- AWS CloudWatch (production)
"""

import asyncio
import logging
import re
import uuid
from abc import ABC, abstractmethod
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class LogEntry:
    """Represents a single log entry."""

    id: str
    timestamp: datetime
    level: str  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    service: str  # web, celery, celery-beat
    message: str
    user_id: int | None = None
    request_id: str | None = None
    raw: str = ''

    def to_camel_dict(self) -> dict:
        """Serialize to camelCase dict for WebSocket (project convention)."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'level': self.level,
            'service': self.service,
            'message': self.message,
            'userId': self.user_id,
            'requestId': self.request_id,
            'raw': self.raw,
        }


@dataclass
class LogFilters:
    """Filters for log streaming."""

    level: str | None = None  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    service: str | None = None  # web, celery, celery-beat
    start_time: datetime | None = None
    end_time: datetime | None = None
    user_id: int | None = None
    request_id: str | None = None
    pattern: str | None = None  # regex pattern
    _compiled_pattern: re.Pattern | None = field(default=None, repr=False)

    @classmethod
    def from_camel_dict(cls, data: dict) -> 'LogFilters':
        """Parse camelCase dict from frontend."""
        start_time = None
        end_time = None

        if data.get('startTime'):
            try:
                start_time = datetime.fromisoformat(data['startTime'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass

        if data.get('endTime'):
            try:
                end_time = datetime.fromisoformat(data['endTime'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass

        return cls(
            level=data.get('level'),
            service=data.get('service'),
            start_time=start_time,
            end_time=end_time,
            user_id=data.get('userId'),
            request_id=data.get('requestId'),
            pattern=data.get('pattern'),
        )

    def __post_init__(self):
        """Pre-compile regex for performance."""
        if self.pattern:
            try:
                self._compiled_pattern = re.compile(self.pattern, re.IGNORECASE)
            except re.error:
                logger.warning(f'Invalid regex pattern: {self.pattern}')
                self._compiled_pattern = None

    def matches(self, log: LogEntry) -> bool:
        """Check if a log entry matches all filters."""
        if self.level and log.level != self.level:
            return False
        if self.service and log.service != self.service:
            return False
        if self.start_time and log.timestamp < self.start_time:
            return False
        if self.end_time and log.timestamp > self.end_time:
            return False
        if self.user_id and log.user_id != self.user_id:
            return False
        if self.request_id and log.request_id != self.request_id:
            return False
        if self.pattern and self._compiled_pattern:
            if not self._compiled_pattern.search(log.message):
                return False
        return True


class LogSource(ABC):
    """Abstract base class for log sources."""

    @abstractmethod
    async def stream_logs(self) -> AsyncIterator[LogEntry]:
        """Stream logs in real-time."""
        pass

    @abstractmethod
    async def get_history(self, limit: int = 100) -> list[LogEntry]:
        """Get recent log history."""
        pass


class DockerLogSource(LogSource):
    """
    Stream logs from Docker containers (local development).

    NOTE: Requires docker socket mount in docker-compose.yml:
      volumes:
        - /var/run/docker.sock:/var/run/docker.sock:ro
    """

    CONTAINERS = {
        'web': 'allthriveai_web_1',
        'celery': 'allthriveai_celery_1',
        'celery-beat': 'allthriveai_celery-beat_1',
    }

    # Log level patterns
    LEVEL_PATTERNS = [
        (re.compile(r'\b(ERROR|CRITICAL)\b', re.IGNORECASE), 'ERROR'),
        (re.compile(r'\bWARNING\b', re.IGNORECASE), 'WARNING'),
        (re.compile(r'\bDEBUG\b', re.IGNORECASE), 'DEBUG'),
        (re.compile(r'\bINFO\b', re.IGNORECASE), 'INFO'),
    ]

    # Extract user_id and request_id from log messages
    USER_ID_PATTERN = re.compile(r'user[_=]?(\d+)', re.IGNORECASE)
    REQUEST_ID_PATTERN = re.compile(r'request[_-]?id[=:]?\s*([a-f0-9-]+)', re.IGNORECASE)

    def __init__(self):
        self._history: deque[LogEntry] = deque(maxlen=500)
        self._docker_client = None

    def _get_docker_client(self):
        """Lazy load docker client."""
        if self._docker_client is None:
            try:
                import docker

                self._docker_client = docker.from_env()
            except Exception as e:
                # Check if it's a permission error (may be wrapped in DockerException)
                error_str = str(e).lower()
                if 'permission denied' in error_str or 'permissionerror' in error_str:
                    error_msg = (
                        'Docker socket access denied. Log streaming unavailable in local dev. '
                        'Logs will work in production via CloudWatch.'
                    )
                    logger.error(f'Docker permission error: {e}')
                    raise PermissionError(error_msg) from e
                logger.error(f'Failed to connect to Docker: {e}')
                raise
        return self._docker_client

    def _parse_log_line(self, line: str, service: str) -> LogEntry | None:
        """Parse a log line into a LogEntry."""
        if not line.strip():
            return None

        # Detect log level
        level = 'INFO'
        for pattern, lvl in self.LEVEL_PATTERNS:
            if pattern.search(line):
                level = lvl
                break

        # Extract user_id
        user_id = None
        user_match = self.USER_ID_PATTERN.search(line)
        if user_match:
            try:
                user_id = int(user_match.group(1))
            except ValueError:
                pass

        # Extract request_id
        request_id = None
        request_match = self.REQUEST_ID_PATTERN.search(line)
        if request_match:
            request_id = request_match.group(1)

        return LogEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            level=level,
            service=service,
            message=line.strip(),
            user_id=user_id,
            request_id=request_id,
            raw=line,
        )

    async def stream_logs(self) -> AsyncIterator[LogEntry]:
        """Stream logs from all Docker containers concurrently."""
        client = self._get_docker_client()
        queue: asyncio.Queue[LogEntry | None] = asyncio.Queue()
        tasks = []

        for service, container_name in self.CONTAINERS.items():
            try:
                container = client.containers.get(container_name)
                # Create task for each container
                task = asyncio.create_task(self._stream_container_to_queue(container, service, queue))
                tasks.append(task)
            except Exception as e:
                logger.warning(f'Failed to get container {container_name}: {e}')

        if not tasks:
            logger.error('No containers available for streaming')
            return

        # Yield logs from queue as they arrive
        try:
            while True:
                log = await queue.get()
                if log is None:
                    break
                self._history.append(log)
                yield log
        finally:
            # Cancel all streaming tasks on disconnect
            for task in tasks:
                task.cancel()

    async def _stream_container_to_queue(self, container, service: str, queue: asyncio.Queue):
        """Stream logs from a container into a shared queue."""
        loop = asyncio.get_event_loop()

        def _get_log_generator():
            return container.logs(stream=True, follow=True, tail=0, timestamps=True)

        try:
            log_gen = await loop.run_in_executor(None, _get_log_generator)

            def _next_line():
                try:
                    return next(log_gen)
                except StopIteration:
                    return None

            while True:
                # Run blocking next() in executor to avoid blocking event loop
                line_bytes = await loop.run_in_executor(None, _next_line)
                if line_bytes is None:
                    break

                try:
                    line = line_bytes.decode('utf-8', errors='replace')
                    log_entry = self._parse_log_line(line, service)
                    if log_entry:
                        await queue.put(log_entry)
                except Exception as e:
                    logger.error(f'Error parsing log line: {e}')

        except asyncio.CancelledError:
            logger.debug(f'Container stream cancelled: {service}')
            raise
        except Exception as e:
            logger.error(f'Error streaming from {service}: {e}')

    async def get_history(self, limit: int = 100) -> list[LogEntry]:
        """Get recent log history from containers."""
        # If we have history in buffer, return it
        if self._history:
            return list(self._history)[-limit:]

        # Otherwise fetch recent logs from containers
        client = self._get_docker_client()
        loop = asyncio.get_event_loop()
        all_logs: list[LogEntry] = []

        per_container_limit = limit // len(self.CONTAINERS) + 10

        for service, container_name in self.CONTAINERS.items():
            try:
                container = client.containers.get(container_name)

                def _get_logs(c=container, n=per_container_limit):
                    return c.logs(tail=n, timestamps=True).decode('utf-8', errors='replace')

                logs_text = await loop.run_in_executor(None, _get_logs)

                for line in logs_text.split('\n'):
                    log_entry = self._parse_log_line(line, service)
                    if log_entry:
                        all_logs.append(log_entry)
                        self._history.append(log_entry)

            except Exception as e:
                logger.warning(f'Failed to get history from {container_name}: {e}')

        # Sort by timestamp and return most recent
        all_logs.sort(key=lambda x: x.timestamp)
        return all_logs[-limit:]


class CloudWatchLogSource(LogSource):
    """
    Stream logs from AWS CloudWatch (production).

    Required IAM permissions:
    - logs:FilterLogEvents
    - logs:DescribeLogGroups
    """

    LOG_GROUPS = [
        '/ecs/allthriveai-production/web',
        '/ecs/allthriveai-production/celery',
    ]
    POLL_INTERVAL = 5  # seconds - balances latency vs API cost

    # Map log group to service name
    LOG_GROUP_TO_SERVICE = {
        '/ecs/allthriveai-production/web': 'web',
        '/ecs/allthriveai-production/celery': 'celery',
    }

    def __init__(self):
        self._history: deque[LogEntry] = deque(maxlen=500)
        self._last_timestamps: dict[str, int] = {}
        self._boto_client = None

    def _get_boto_client(self):
        """Lazy load boto3 client."""
        if self._boto_client is None:
            import boto3

            self._boto_client = boto3.client('logs')
        return self._boto_client

    def _parse_cloudwatch_event(self, event: dict, log_group: str) -> LogEntry:
        """Parse a CloudWatch log event into a LogEntry."""
        message = event.get('message', '')
        timestamp = datetime.fromtimestamp(event.get('timestamp', 0) / 1000)
        service = self.LOG_GROUP_TO_SERVICE.get(log_group, 'unknown')

        # Detect log level
        level = 'INFO'
        for lvl in ['ERROR', 'CRITICAL', 'WARNING', 'DEBUG']:
            if lvl in message.upper():
                level = lvl
                break

        # Extract user_id and request_id
        user_id = None
        request_id = None

        user_match = re.search(r'user[_=]?(\d+)', message, re.IGNORECASE)
        if user_match:
            try:
                user_id = int(user_match.group(1))
            except ValueError:
                pass

        request_match = re.search(r'request[_-]?id[=:]?\s*([a-f0-9-]+)', message, re.IGNORECASE)
        if request_match:
            request_id = request_match.group(1)

        return LogEntry(
            id=event.get('eventId', str(uuid.uuid4())),
            timestamp=timestamp,
            level=level,
            service=service,
            message=message,
            user_id=user_id,
            request_id=request_id,
            raw=message,
        )

    async def stream_logs(self) -> AsyncIterator[LogEntry]:
        """Poll CloudWatch for new logs every POLL_INTERVAL seconds."""
        client = self._get_boto_client()
        loop = asyncio.get_event_loop()

        while True:
            for log_group in self.LOG_GROUPS:
                try:
                    # Get start time (last seen or 5 minutes ago)
                    start_time = self._last_timestamps.get(log_group)
                    if start_time is None:
                        # Start from 5 minutes ago on first run
                        start_time = int((datetime.now().timestamp() - 300) * 1000)

                    # Poll CloudWatch in executor (blocking call)
                    # NOTE: Use default args to capture values at definition time (closure fix)
                    response = await loop.run_in_executor(
                        None,
                        lambda lg=log_group, st=start_time: client.filter_log_events(
                            logGroupName=lg,
                            startTime=st,
                            limit=100,
                        ),
                    )

                    events = response.get('events', [])
                    for event in events:
                        log_entry = self._parse_cloudwatch_event(event, log_group)
                        self._history.append(log_entry)
                        yield log_entry

                        # Update last timestamp
                        event_ts = event.get('timestamp', 0)
                        if event_ts > self._last_timestamps.get(log_group, 0):
                            self._last_timestamps[log_group] = event_ts + 1

                except Exception as e:
                    logger.error(f'Error polling CloudWatch log group {log_group}: {e}')

            await asyncio.sleep(self.POLL_INTERVAL)

    async def get_history(self, limit: int = 100) -> list[LogEntry]:
        """Get recent log history from CloudWatch."""
        if self._history:
            return list(self._history)[-limit:]

        # Fetch initial history from CloudWatch
        client = self._get_boto_client()
        loop = asyncio.get_event_loop()
        all_logs = []

        for log_group in self.LOG_GROUPS:
            try:
                start_time = int((datetime.now().timestamp() - 300) * 1000)  # Last 5 minutes

                # NOTE: Use default args to capture values at definition time (closure fix)
                response = await loop.run_in_executor(
                    None,
                    lambda lg=log_group, st=start_time, lim=limit: client.filter_log_events(
                        logGroupName=lg,
                        startTime=st,
                        limit=lim,
                    ),
                )

                for event in response.get('events', []):
                    log_entry = self._parse_cloudwatch_event(event, log_group)
                    all_logs.append(log_entry)
                    self._history.append(log_entry)

            except Exception as e:
                logger.error(f'Error fetching CloudWatch history from {log_group}: {e}')

        # Sort by timestamp and return most recent
        all_logs.sort(key=lambda x: x.timestamp)
        return all_logs[-limit:]


# Singleton instances to preserve history buffer across connections
_docker_log_source: DockerLogSource | None = None
_cloudwatch_log_source: CloudWatchLogSource | None = None


def get_log_source() -> LogSource:
    """Get the appropriate log source based on environment (singleton pattern)."""
    global _docker_log_source, _cloudwatch_log_source

    if settings.DEBUG:
        if _docker_log_source is None:
            _docker_log_source = DockerLogSource()
        return _docker_log_source

    if _cloudwatch_log_source is None:
        _cloudwatch_log_source = CloudWatchLogSource()
    return _cloudwatch_log_source
