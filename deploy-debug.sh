#!/bin/bash

# Set AWS region
export AWS_REGION=us-east-1

# Function names
LABS_FUNCTION_NAME="Ece4180Stack-LabsFunction92D996AE-TItfCPRDksmU"
PART_SUBMISSIONS_FUNCTION_NAME="Ece4180Stack-PartSubmissionsFunction201E1970-1RIFMFFLUrym"

# Path to the lambda code
LAMBDA_CODE_PATH="./lambda"

# Create a temporary zip file
ZIP_FILE="/tmp/lambda-debug.zip"

echo "Creating zip file of lambda code..."
cd $LAMBDA_CODE_PATH
zip -r $ZIP_FILE .

echo "Updating labs lambda function..."
aws lambda update-function-code \
  --function-name $LABS_FUNCTION_NAME \
  --zip-file fileb://$ZIP_FILE

echo "Updating part-submissions lambda function..."
aws lambda update-function-code \
  --function-name $PART_SUBMISSIONS_FUNCTION_NAME \
  --zip-file fileb://$ZIP_FILE

echo "Deployment complete!"