# CodeBoomz LMS - container image (used by Render, Koyeb, or any Docker host)
FROM node:22-slim

# Python 3 is needed for Python challenges in the Code Lab
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Show dates/times in Indian time; Render sends traffic to port 10000
ENV NODE_ENV=production \
    TZ=Asia/Kolkata \
    PORT=10000

# Run as the unprivileged "node" user (safer for the Code Lab)
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 10000
CMD ["node", "--no-warnings", "server/index.js"]
