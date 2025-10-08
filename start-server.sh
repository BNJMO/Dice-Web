#!/bin/bash

# Simple server starter for Mac/Linux
# Run with: bash start-server.sh
# Or make executable: chmod +x start-server.sh && ./start-server.sh

echo ""
echo "========================================"
echo "  Mines Game - Starting Server"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    echo ""
    npm install
    echo ""
fi

# Start the development server
echo "🚀 Starting Vite development server..."
echo ""
echo "The game will open automatically in your browser."
echo "If not, navigate to: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server."
echo ""

npm run dev

