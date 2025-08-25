#!/bin/bash

# Exit on error
set -e

echo "===== Testing Staff Pages Implementation ====="

# Step 1: Deploy CDK changes
echo "Deploying CDK changes..."
cd infrastructure
npm run cdk deploy

# Step 2: Import student data
echo "Importing student data..."
./import-all-students.sh

# Step 3: Start the frontend for testing
echo "Starting the frontend for testing..."
cd ../frontend
npm start

echo "===== Implementation Test Complete ====="
echo "Please verify the following:"
echo "1. The People page displays all students with their progress"
echo "2. Clicking on a student shows their detailed progress"
echo "3. You can update grades and check off lab parts for students"
echo "4. The navigation works correctly between pages"