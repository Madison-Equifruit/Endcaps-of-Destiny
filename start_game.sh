#!/bin/bash
echo "Starting Banana Badass: Endcaps of Destiny..."
echo ""
echo "Game will open at: http://localhost:8000"
echo "Leaderboard display: http://localhost:8000/leaderboard.html"
echo ""
echo "Press Ctrl+C to stop the server when done."
echo ""

# Navigate to output folder
cd "$(dirname "$0")/output"

# Open Chrome after a short delay
sleep 1 && open -a "Google Chrome" "http://localhost:8000" &

# Start the server
python3 -m http.server 8000
