const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS SDK for local testing
AWS.config.update({
  region: 'us-east-1',
  // For local testing, you would need to set up credentials
  // This is just for demonstration purposes
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const LABS_TABLE = 'ece4180-labs-v1'; // Table name

// Import the handler function from import-labs.js
const { handler } = require('./import-labs');

// Mock environment variables
process.env.LABS_TABLE = LABS_TABLE;

async function runTest() {
  try {
    console.log('Starting test for lab content import');
    
    // Step 1: Create a test lab with a specific locked status
    const testLabId = 'test-lab';
    const initialLockedStatus = true; // Set initial status to locked
    
    const testLab = {
      labId: testLabId,
      title: 'Test Lab',
      description: 'This is a test lab',
      content: 'Test content',
      order: 999,
      locked: initialLockedStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log(`Creating test lab with locked status: ${initialLockedStatus}`);
    await dynamodb.put({
      TableName: LABS_TABLE,
      Item: testLab
    }).promise();
    
    // Step 2: Create a test JSON file that would update this lab
    const testLabDir = path.join(__dirname, 'lab-content');
    const testLabPath = path.join(testLabDir, `${testLabId}.json`);
    
    // Make sure the lab content directory exists
    if (!fs.existsSync(testLabDir)) {
      fs.mkdirSync(testLabDir, { recursive: true });
    }
    
    // Create a modified version of the lab with different content but no locked status
    const updatedLab = {
      ...testLab,
      description: 'This is an updated test lab',
      content: 'Updated test content'
      // Note: We intentionally omit the locked field to test preservation
    };
    
    fs.writeFileSync(testLabPath, JSON.stringify(updatedLab, null, 2));
    console.log(`Created test lab JSON file at ${testLabPath}`);
    
    // Step 3: Run the import handler
    console.log('Running import handler...');
    await handler({}, {});
    
    // Step 4: Verify the lab was updated but locked status was preserved
    const result = await dynamodb.get({
      TableName: LABS_TABLE,
      Key: { labId: testLabId }
    }).promise();
    
    const updatedLabFromDB = result.Item;
    console.log('Updated lab from DynamoDB:', updatedLabFromDB);
    
    if (updatedLabFromDB.locked === initialLockedStatus) {
      console.log('✅ TEST PASSED: Locked status was preserved');
    } else {
      console.log(`❌ TEST FAILED: Locked status was changed from ${initialLockedStatus} to ${updatedLabFromDB.locked}`);
    }
    
    if (updatedLabFromDB.description === updatedLab.description) {
      console.log('✅ TEST PASSED: Content was updated');
    } else {
      console.log(`❌ TEST FAILED: Content was not updated`);
    }
    
    // Step 5: Clean up
    console.log('Cleaning up test data...');
    fs.unlinkSync(testLabPath);
    
    await dynamodb.delete({
      TableName: LABS_TABLE,
      Key: { labId: testLabId }
    }).promise();
    
    console.log('Test completed');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest();