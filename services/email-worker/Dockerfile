FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY services/email-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy email worker source code
COPY services/email-worker/ .
COPY shared/ /app/shared/

# Create non-root user
RUN useradd --create-home --shell /bin/bash worker
USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import redis; redis.Redis(host='redis', port=6379).ping()" || exit 1

# Start Celery worker with beat scheduler (runs scheduled tasks + processes queue)
CMD ["celery", "-A", "main", "worker", "--loglevel=info", "--concurrency=2", "--beat"]