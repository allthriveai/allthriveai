"""
Phoenix Observability Service - LLM Tracing & Evaluation

This service provides:
1. Local tracing UI (configured via PHOENIX_PORT env var)
2. Production tracing to Arize Cloud
3. Auto-instrumentation for OpenAI, LangChain, and Anthropic
4. Hallucination and relevance evaluation

Usage:
    # Initialized automatically on Django startup via AppConfig.ready()
    # Traces appear at local Phoenix UI or Arize Cloud (production)
"""

import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)

# Global state
_phoenix_initialized = False
_phoenix_session = None

# Phoenix configuration from environment
PHOENIX_HOST = os.getenv('PHOENIX_HOST', '0.0.0.0')  # noqa: S104 - bind all interfaces for Docker
PHOENIX_PORT = os.getenv('PHOENIX_PORT', '6006')
PHOENIX_CLOUD_ENDPOINT = 'https://app.phoenix.arize.com/v1/traces'


def _get_local_phoenix_url() -> str:
    """Build the local Phoenix URL from environment config."""
    # Use localhost for browser access, even if server binds to 0.0.0.0
    return f'http://127.0.0.1:{PHOENIX_PORT}'


def _get_local_traces_endpoint() -> str:
    """Build the local OTLP traces endpoint."""
    return f'http://127.0.0.1:{PHOENIX_PORT}/v1/traces'


def initialize_phoenix():
    """
    Initialize Phoenix tracing based on environment.

    Local: Launches Phoenix UI (port from PHOENIX_PORT env var)
    Production: Sends traces to Arize Cloud via OTLP
    """
    global _phoenix_initialized, _phoenix_session

    if _phoenix_initialized:
        return

    if not getattr(settings, 'PHOENIX_ENABLED', True):
        logger.info('Phoenix tracing disabled via PHOENIX_ENABLED=false')
        _phoenix_initialized = True
        return

    try:
        from openinference.instrumentation.langchain import LangChainInstrumentor
        from openinference.instrumentation.openai import OpenAIInstrumentor

        environment = os.getenv('ENVIRONMENT', 'development')
        phoenix_api_key = getattr(settings, 'PHOENIX_API_KEY', '')

        if environment == 'production' or phoenix_api_key:
            # Production: Send to Arize Cloud via HTTP
            logger.info('Initializing Phoenix for production (Arize Cloud)')

            from opentelemetry import trace as otel_trace
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
            from opentelemetry.sdk import trace as trace_sdk
            from opentelemetry.sdk.trace.export import SimpleSpanProcessor

            tracer_provider = trace_sdk.TracerProvider()
            tracer_provider.add_span_processor(
                SimpleSpanProcessor(
                    OTLPSpanExporter(
                        endpoint=PHOENIX_CLOUD_ENDPOINT,
                        headers={'api_key': phoenix_api_key},
                    )
                )
            )
            otel_trace.set_tracer_provider(tracer_provider)

            logger.info('Phoenix tracing to Arize Cloud: %s', PHOENIX_CLOUD_ENDPOINT)

        else:
            # Local: Launch Phoenix UI with HTTP collector (not gRPC)
            logger.info('Initializing Phoenix for local development')

            import phoenix as px
            from opentelemetry import trace as otel_trace
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
            from opentelemetry.sdk import trace as trace_sdk
            from opentelemetry.sdk.trace.export import SimpleSpanProcessor

            # Disable gRPC to avoid port conflicts
            os.environ['PHOENIX_GRPC_PORT'] = '0'

            # Launch Phoenix UI
            _phoenix_session = px.launch_app()

            # Set up HTTP exporter to local Phoenix
            local_endpoint = _get_local_traces_endpoint()
            tracer_provider = trace_sdk.TracerProvider()
            tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint=local_endpoint)))
            otel_trace.set_tracer_provider(tracer_provider)

            logger.info('Phoenix UI available at: %s', _get_local_phoenix_url())

        # Instrument OpenAI (covers AzureOpenAI) and LangChain
        OpenAIInstrumentor().instrument()
        LangChainInstrumentor().instrument()

        logger.info('Phoenix instrumentation complete (OpenAI + LangChain)')
        _phoenix_initialized = True

    except ImportError as e:
        logger.warning('Phoenix not installed, tracing disabled: %s', e)
        _phoenix_initialized = True
    except Exception as e:
        logger.error('Failed to initialize Phoenix: %s', e, exc_info=True)
        _phoenix_initialized = True


def get_phoenix_url() -> str | None:
    """Get the Phoenix UI URL if running locally."""
    global _phoenix_session
    if _phoenix_session:
        return _get_local_phoenix_url()
    return None


def is_phoenix_enabled() -> bool:
    """Check if Phoenix tracing is active."""
    return _phoenix_initialized and getattr(settings, 'PHOENIX_ENABLED', True)
