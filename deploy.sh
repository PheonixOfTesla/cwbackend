#!/bin/bash
echo "Deploying Coastal Fitness Application..."

# Set production environment
export NODE_ENV=production

# Install production dependencies only
npm install --production

# Start the application with PM2 (if installed)
if command -v pm2 &> /dev/null; then
    pm2 start src/server.js --name coastal-fitness
    pm2 save
else
    # Fall back to regular node
    node src/server.js
fi
