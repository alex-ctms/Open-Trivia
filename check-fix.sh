#!/bin/bash

echo "======================================"
echo "TRIVIA APP - COMPLETE LOGIN FIX"
echo "======================================"
echo ""

echo "Step 1: Checking current file..."
if grep -q "const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'" frontend/src/App.js; then
    echo "✅ App.js already has the fallback URL - GOOD!"
else
    echo "❌ App.js is missing the fallback URL - NEEDS FIX"
    echo ""
    echo "Current line in App.js:"
    grep "const API_URL" frontend/src/App.js
    echo ""
    echo "This is your problem! The API_URL is undefined."
fi

echo ""
echo "Step 2: What you need to do:"
echo "======================================"
echo ""
echo "Replace frontend/src/App.js line 104 from:"
echo "    const API_URL = process.env.REACT_APP_API_URL;"
echo ""
echo "To:"
echo "    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';"
echo ""
echo "Or just replace the entire App.js file with the one I provided."
echo ""
echo "======================================"
echo ""
echo "Step 3: After updating the file, run:"
echo "    docker-compose restart frontend"
echo ""
echo "Step 4: Open browser console (F12) and you should see:"
echo "    🔧 API URL configured as: http://localhost:5000/api"
echo ""
echo "Step 5: Try login again with:"
echo "    Email: admin@trivia.com"
echo "    Password: admin123"
echo ""
echo "======================================"
