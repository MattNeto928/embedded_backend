#!/bin/bash

# Deploy the part-submissions Lambda function
echo "Deploying part-submissions Lambda function..."

# Use the known Lambda function name
FUNCTION_NAME="Ece4180Stack-PartSubmissionsFunction201E1970-1RIFMFFLUrym"
echo "Using Lambda function: $FUNCTION_NAME"

# Create a temporary zip file
echo "Creating deployment package..."
mkdir -p temp
cp infrastructure/lambda/part-submissions.js temp/
cd temp
npm init -y
npm install aws-sdk uuid
zip -r ../part-submissions.zip .
cd ..

# Update the Lambda function code
echo "Updating Lambda function code..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://part-submissions.zip

# Clean up
echo "Cleaning up..."
rm -rf temp
rm part-submissions.zip

echo "Deployment completed successfully!"