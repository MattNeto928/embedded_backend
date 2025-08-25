#!/bin/bash

# Exit on error
set -e

echo "===== Importing All Students from students.json ====="

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Check if students.json exists
if [ ! -f "../students.json" ]; then
    echo "Error: students.json file not found in the project root directory."
    exit 1
fi

echo "Found students.json with $(grep -c "name" ../students.json) students"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "AWS credentials verified"

# Run the import script
echo "Running import script..."
node lambda/import-students.js

echo "===== Import Complete ====="
echo "All students from students.json have been imported to the database."
echo "You can now view them in the People page of the application."