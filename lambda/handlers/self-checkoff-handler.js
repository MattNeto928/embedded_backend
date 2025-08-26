const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * Handler for self check-off submissions
 */
exports.handler = async (event) => {
  try {
    console.log('Self check-off submission event:', JSON.stringify(event));
    
    // Parse request body
    const body = JSON.parse(event.body);
    const { labId, partId, notes = '' } = body;
    
    // Get user info from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;
    const username = event.requestContext.authorizer.claims.username || event.requestContext.authorizer.claims.email;
    const studentId = event.requestContext.authorizer.claims['custom:studentId'] || '';
    
    // Validate required fields
    if (!labId || !partId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Missing required fields: labId and partId are required' })
      };
    }
    
    // Generate a unique submission ID
    const submissionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create submission record
    const submission = {
      submissionId,
      labId,
      partId,
      userId,
      username,
      studentId,
      fileKey: '', // No file for self check-off
      notes,
      status: 'approved', // Auto-approve self check-offs
      submittedAt: timestamp,
      updatedAt: timestamp,
      reviewedAt: timestamp,
      reviewedBy: 'system', // Auto-approved by system
    };
    
    // Save to DynamoDB
    await dynamoDB.put({
      TableName: process.env.PART_SUBMISSIONS_TABLE,
      Item: submission
    }).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Self check-off submitted successfully',
        submissionId,
        status: 'approved'
      })
    };
  } catch (error) {
    console.error('Error processing self check-off submission:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Error processing self check-off submission' })
    };
  }
};