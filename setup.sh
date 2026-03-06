#!/bin/bash
# portfolio-tracker — First-time setup

set -e

echo ""
echo "========================================"
echo "  portfolio-tracker — Setup"
echo "========================================"
echo ""

# Check Python 3
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required. Install from https://python.org"
    exit 1
fi

# Check Node.js (for dashboard)
if ! command -v node &>/dev/null; then
    echo "⚠️  Node.js not found — dashboard app won't be available."
    echo "   Install from https://nodejs.org"
fi

# Python venv
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

# Copy example files if they don't exist
if [ ! -f "data/holdings.json" ]; then
    echo ""
    echo "📋 Copying data templates..."
    cp data/holdings.example.json data/holdings.json
    echo "   ✅ Created data/holdings.json"
    echo "   ⚠️  Edit it with your actual holdings before running scripts."
fi

mkdir -p data/snapshots

if [ ! -f "data/deposits.json" ]; then
    cp data/deposits.example.json data/deposits.json
    echo "   ✅ Created data/deposits.json (empty)"
fi

if [ ! -f "data/targets.json" ]; then
    cp data/targets.example.json data/targets.json
    echo "   ✅ Created data/targets.json — edit to set your target allocations"
fi

if [ ! -f "data/transactions.json" ]; then
    cp data/transactions.example.json data/transactions.json
    echo "   ✅ Created data/transactions.json (empty)"
fi

if [ ! -f "data/config.json" ]; then
    cp data/config.example.json data/config.json
    echo "   ✅ Created data/config.json — edit to set base currency and expense basket"
fi

# Install dashboard dependencies
if command -v node &>/dev/null && [ -d "app" ]; then
    echo ""
    echo "📦 Installing dashboard (Next.js) dependencies..."
    cd app && npm install --silent && cd ..
fi

echo ""
echo "========================================"
echo "  ✅ Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit data/holdings.json with your holdings"
echo "  2. source venv/bin/activate"
echo "  3. python3 scripts/update_portfolio.py     # fetch live prices"
echo "  4. python3 scripts/save_snapshot.py        # save a snapshot"
echo "  5. cd app && DATA_DIR=../data npm start     # launch dashboard"
echo "     → http://localhost:3000"
echo ""
