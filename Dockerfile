# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        netcat-traditional \
        ffmpeg \
        libpq5 \
        ffmpeg \
        ca-certificates \
        curl \
        openssl \
        postgresql-client \
        redis \
        aws-cli \
        && update-ca-certificates \
        && curl -fsSL https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem -o /etc/ssl/certs/rds-us-east-1-bundle.pem \
        && rm -rf /var/lib/apt/lists/*

# Install yt-dlp for Reddit video downloading
RUN pip install --no-cache-dir yt-dlp

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create a non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python manage.py check --deploy

# Default command - Use daphne for ASGI/WebSocket support
# Note: For development with hot-reload, docker-compose uses startup.sh with uvicorn
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
