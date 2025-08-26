#!/bin/bash
set -e

echo "Deploying GSI fix for lab access..."

# Navigate to the infrastructure directory
cd "$(dirname "$0")"

# Deploy the updated stack
npx cdk deploy

echo "Deployment complete! The GSI fix has been applied."
echo "Students should now be able to access unlocked labs."