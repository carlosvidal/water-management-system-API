#!/bin/sh

# Exit on error
set -e

echo "🚀 Starting AquaFlow API..."

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "📊 Running database migrations..."
    npx prisma migrate deploy || echo "⚠️  Migration failed, continuing anyway..."
else
    echo "⚠️  DATABASE_URL not set, skipping migrations"
fi

# Start the application
echo "✅ Starting Node.js application..."
exec node dist/index.js
