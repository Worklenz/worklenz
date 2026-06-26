#!/bin/bash

echo "🌍 Starting Holiday Population Script..."
echo "This will populate the database with holidays for 200+ countries using the date-holidays npm package."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if the script exists
if [ ! -f "scripts/populate-holidays.js" ]; then
    echo "❌ Holiday population script not found."
    exit 1
fi

# Run the holiday population script
echo "🚀 Running holiday population script..."
node scripts/populate-holidays.js

echo ""
echo "✅ Holiday population completed!"
echo "You can now use the holiday import feature in the admin center." 