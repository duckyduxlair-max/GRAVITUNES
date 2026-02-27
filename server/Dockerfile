FROM node:18-bullseye-slim

# Install necessary system dependencies for audio extraction
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set the working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Ensure the temp directory exists
RUN mkdir -p temp

# Expose the API port
EXPOSE 5000

# Start the Express server
CMD ["npm", "start"]
