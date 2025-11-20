#!/bin/bash
# Test script to simulate Railway's build process

set -e

echo "🧪 Testing Railway Build Process"
echo "================================="
echo ""

# Clean up any existing test venv
rm -rf /tmp/test_venv

# Step 1: Create venv (simulating Railway)
echo "1. Creating virtual environment..."
python3.10 -m venv /tmp/test_venv
echo "✅ Virtual environment created"

# Step 2: Ensure pip
echo ""
echo "2. Installing pip in venv..."
/tmp/test_venv/bin/python3.10 -m ensurepip --upgrade
echo "✅ pip installed"

# Step 3: Upgrade pip
echo ""
echo "3. Upgrading pip..."
/tmp/test_venv/bin/pip install --upgrade pip setuptools wheel
echo "✅ pip upgraded"

# Step 4: Install requirements
echo ""
echo "4. Installing requirements..."
/tmp/test_venv/bin/pip install -r requirements.txt
echo "✅ Requirements installed"

# Step 5: Test that uvicorn is available
echo ""
echo "5. Testing uvicorn..."
if /tmp/test_venv/bin/uvicorn --version > /dev/null 2>&1; then
    echo "✅ uvicorn is available"
    /tmp/test_venv/bin/uvicorn --version
else
    echo "❌ uvicorn not found"
    exit 1
fi

# Step 6: Test that app can be imported
echo ""
echo "6. Testing app import..."
if /tmp/test_venv/bin/python3.10 -c "import app; print('✅ app.py imports successfully')" 2>&1; then
    echo "✅ app.py imports successfully"
else
    echo "❌ Failed to import app.py"
    exit 1
fi

# Step 7: Test that model loading works (if model exists)
echo ""
echo "7. Testing model loading..."
if [ -f models/model.pkl ]; then
    if /tmp/test_venv/bin/python3.10 -c "import joblib; joblib.load('models/model.pkl'); print('✅ Model loads successfully')" 2>&1; then
        echo "✅ Model loads successfully"
    else
        echo "⚠️  Model file exists but failed to load (may need to check paths)"
    fi
else
    echo "⚠️  Model file not found (will use placeholder predictions)"
fi

echo ""
echo "================================="
echo "✅ Railway build simulation successful!"
echo ""
echo "The build should work on Railway. Next steps:"
echo "1. git add railway.json nixpacks.toml"
echo "2. git commit -m 'Fix Railway build: use venv and remove redundant build command'"
echo "3. git push"

