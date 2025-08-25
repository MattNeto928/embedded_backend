#!/bin/bash

# Exit on error
set -e

echo "===== Deploying CORS Fix for Staff Pages ====="

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Deploy CDK changes
echo "Deploying CDK changes with CORS fixes..."
npm run cdk deploy

echo "===== CORS Fix Deployed ====="
echo "The CORS configuration has been updated to allow requests from any origin."
echo "You can now test the implementation by running:"
echo "./test-implementation.sh"