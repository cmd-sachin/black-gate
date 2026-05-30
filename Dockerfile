# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8080

# Set working directory
WORKDIR /app

# Install system dependencies, including Node.js (for proxy if needed), Suricata, and Zeek dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    procps \
    libpcap-dev \
    suricata \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Note: Zeek can be installed from custom repositories if needed in production:
# RUN echo 'deb http://download.opensuse.org/repositories/security:/zeek/Debian_11/ /' > /etc/apt/sources.list.d/security:zeek.list \
#     && curl -fsSL https://download.opensuse.org/repositories/security:zeek/Debian_11/Release.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/security_zeek.gpg > /dev/null \
#     && apt-get update && apt-get install -y zeek

# Copy requirements and install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node MCP dependencies used by the ADK MCP bridge
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev --ignore-scripts

# Copy the application code
COPY backend/ ./backend/
COPY convert_hex_to_pcap.py .

# Copy default configurations if needed
RUN mkdir -p /app/zeek_logs /app/suricata_logs

# Expose the Cloud Run port
EXPOSE 8080

# Start the application
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
