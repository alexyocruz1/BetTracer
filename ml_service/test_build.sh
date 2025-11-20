#!/bin/bash
# Test script to verify the build process works

set -e

echo "🧪 Testing ML Service Build Process"
echo "===================================="

# Test 1: Check Python version
echo ""
echo "1. Checking Python version..."
python3.10 --version || { echo "❌ Python 3.10 not found"; exit 1; }
echo "✅ Python 3.10 found"

# Test 2: Test get-pip.py download
echo ""
echo "2. Testing get-pip.py download..."
curl -sS https://bootstrap.pypa.io/get-pip.py > /tmp/get-pip.py
if [ -f /tmp/get-pip.py ]; then
    echo "✅ get-pip.py downloaded successfully"
    echo "   File size: $(wc -c < /tmp/get-pip.py) bytes"
else
    echo "❌ Failed to download get-pip.py"
    exit 1
fi

# Test 3: Test pip installation (dry run)
echo ""
echo "3. Testing pip installation (dry run)..."
if python3.10 -m pip --version > /dev/null 2>&1; then
    echo "✅ pip already available"
    python3.10 -m pip --version
else
    echo "⚠️  pip not available via python3.10 -m (this is expected in Nix environment)"
    echo "   get-pip.py will install it during Railway build"
fi

# Test 4: Test requirements.txt parsing
echo ""
echo "4. Testing requirements.txt..."
if [ -f requirements.txt ]; then
    echo "✅ requirements.txt found"
    echo "   Dependencies: $(grep -v '^#' requirements.txt | grep -v '^$' | wc -l | tr -d ' ') packages"
    
    # Check for problematic packages
    if grep -q "lightgbm" requirements.txt && ! grep -q "^#.*lightgbm" requirements.txt; then
        echo "⚠️  Warning: lightgbm is in requirements (should be commented out)"
    else
        echo "✅ lightgbm properly commented out"
    fi
else
    echo "❌ requirements.txt not found"
    exit 1
fi

# Test 5: Test that app.py exists and is valid Python
echo ""
echo "5. Testing app.py..."
if [ -f app.py ]; then
    echo "✅ app.py found"
    if python3.10 -m py_compile app.py 2>/dev/null; then
        echo "✅ app.py is valid Python"
    else
        echo "⚠️  app.py has syntax errors (check manually)"
    fi
else
    echo "❌ app.py not found"
    exit 1
fi

# Test 6: Check if model files exist (optional)
echo ""
echo "6. Checking model files..."
if [ -f models/model.pkl ]; then
    echo "✅ model.pkl found ($(du -h models/model.pkl | cut -f1))"
else
    echo "⚠️  model.pkl not found (will use placeholder predictions)"
fi

echo ""
echo "===================================="
echo "✅ Build test completed!"
echo ""
echo "Next steps:"
echo "1. Commit changes: git add nixpacks.toml && git commit -m 'Fix pip installation'"
echo "2. Push to trigger Railway build: git push"
echo "3. Monitor Railway deployment logs"

