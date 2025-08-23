const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Environment variables from CDK
const LABS_TABLE = process.env.LABS_TABLE;

/**
 * Lambda function to import lab content from JSON files into DynamoDB
 * This preserves the "locked" status of existing labs
 */
exports.handler = async (event, context) => {
  console.log('Starting lab content import');
  
  try {
    // Get the directory where the lab content JSON files are stored
    const contentDir = path.join(__dirname, 'lab-content');
    
    // Read all JSON files in the directory
    const files = fs.readdirSync(contentDir).filter(file => file.endsWith('.json'));
    console.log(`Found ${files.length} lab content files`);
    
    // Process each file
    for (const file of files) {
      const filePath = path.join(contentDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const labId = content.labId;
      
      // Check if the lab already exists in DynamoDB
      const existingLab = await getExistingLab(labId);
      
      if (existingLab) {
        // Preserve the locked status from the existing lab
        content.locked = existingLab.locked;
        console.log(`Updating lab ${labId}, preserving locked status: ${content.locked}`);
      } else {
        // Set default locked status for new labs (all labs except lab0 are locked by default)
        content.locked = labId !== 'lab0';
        console.log(`Creating new lab ${labId} with locked status: ${content.locked}`);
      }
      
      // Update the timestamps
      content.updatedAt = new Date().toISOString();
      if (!content.createdAt) {
        content.createdAt = new Date().toISOString();
      }
      
      // Write to DynamoDB
      await dynamodb.put({
        TableName: LABS_TABLE,
        Item: content
      }).promise();
      
      console.log(`Successfully imported lab ${labId}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully imported ${files.length} labs` })
    };
  } catch (error) {
    console.error('Error importing lab content:', error);
    throw error;
  }
};

/**
 * Get an existing lab from DynamoDB
 * @param {string} labId - The ID of the lab to retrieve
 * @returns {Promise<Object|null>} - The lab object or null if not found
 */
async function getExistingLab(labId) {
  try {
    const result = await dynamodb.get({
      TableName: LABS_TABLE,
      Key: { labId }
    }).promise();
    
    return result.Item;
  } catch (error) {
    console.error(`Error getting lab ${labId}:`, error);
    return null;
  }
}