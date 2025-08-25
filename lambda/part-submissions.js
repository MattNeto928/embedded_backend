const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const { v4: uuidv4 } = require('uuid');

// Environment variables from CDK
const PART_SUBMISSIONS_TABLE = process.env.PART_SUBMISSIONS_TABLE || 'ece4180-part-submissions';
const CHECKOFF_VIDEO_BUCKET = process.env.CHECKOFF_VIDEO_BUCKET || 'ece4180-checkoff-videos';
const STUDENTS_TABLE = process.env.STUDENTS_TABLE || 'ece4180-students';
const LAB_PROGRESS_TABLE = process.env.LAB_PROGRESS_TABLE || 'ece4180-lab-progress';

exports.handler = async (event) => {
  // Get the origin from the request headers or use a default
  const origin = event.headers?.origin || event.headers?.Origin || 'http://localhost:3000';
  
  // List of allowed origins - make sure to include all frontend domains
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ece4180.vercel.app',
    'https://embedded-website-2.vercel.app',
    'https://embedded-website-2-git-main.vercel.app'
  ];
  
  // Check if the origin is allowed
  const isAllowedOrigin = allowedOrigins.includes(origin);
  
  // Set CORS headers - use specific origin if it's in the allowed list, otherwise use '*'
  const headers = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT',
    'Access-Control-Allow-Credentials': 'true'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract user information from the JWT token
    const token = event.headers?.Authorization?.split(' ')[1] ||
                  event.headers?.authorization?.split(' ')[1];
                  
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized - No token provided' })
      };
    }

    // Parse the JWT token to get user info
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const userId = payload.sub;
    const userRole = payload['custom:role'] || 'student';
    const studentId = payload['custom:studentId'] || payload.email;

    // Route the request based on the HTTP method and path
    const { httpMethod, path } = event;
    
    // Log the path for debugging
    console.log('Path:', path);
    
    // Handle potential path format issues
    // API Gateway might include the stage name in the path (e.g., /prod/part-submissions/queue)
    // First, remove any stage prefix if present
    const normalizedPath = path.replace(/^\/[^\/]+\//, '/');
    console.log('Normalized path:', normalizedPath);
    
    // Split the path into parts
    const pathParts = normalizedPath.split('/').filter(part => part); // Remove empty parts
    console.log('Path parts:', pathParts);
    
    // Special case for direct presigned-url request
    if (pathParts.length === 1 && pathParts[0] === 'presigned-url') {
      console.log('Direct presigned-url request detected, treating as part-submissions/presigned-url');
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        return await getPresignedUrl(body, userId, studentId, headers);
      }
    }
    
    // Special case for direct queue request
    if (pathParts.length === 1 && pathParts[0] === 'queue') {
      console.log('Direct queue request detected');
      return await getSubmissionQueue(headers);
    }
    
    // Check if the path contains 'part-submissions'
    const partSubmissionsIndex = pathParts.findIndex(part => part === 'part-submissions');
    
    // If 'part-submissions' is in the path, extract the resource and action
    let resource, submissionId, action;
    
    if (partSubmissionsIndex !== -1) {
      resource = 'part-submissions';
      submissionId = pathParts[partSubmissionsIndex + 1];
      action = pathParts[partSubmissionsIndex + 2];
    } else {
      // Check if this is a UUID, which might be a submission ID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (pathParts.length === 1 && uuidPattern.test(pathParts[0])) {
        console.log('UUID detected in path, treating as part-submissions/{submissionId}');
        resource = 'part-submissions';
        submissionId = pathParts[0];
        action = undefined;
      } else {
        // Default parsing if 'part-submissions' is not found
        resource = pathParts[0];
        submissionId = pathParts[1];
        action = pathParts[2];
      }
    }
    
    console.log('Resource:', resource);
    console.log('Submission ID:', submissionId);
    console.log('Action:', action);
    
    // Handle the case where the path is /part-submissions/presigned-url
    if (resource === 'part-submissions' && submissionId === 'presigned-url') {
      console.log('Presigned URL request detected');
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        return await getPresignedUrl(body, userId, studentId, headers);
      }
    }
    
    // Handle the case where the path is /part-submissions/queue
    if (resource === 'part-submissions' && submissionId === 'queue') {
      console.log('Queue request detected');
      return await getSubmissionQueue(headers);
    }
    
    if (resource === 'part-submissions') {
      // GET /part-submissions - List submissions (with optional filters)
      if (httpMethod === 'GET' && !submissionId) {
        // Staff can see all submissions, students can only see their own
        if (userRole === 'staff') {
          // Check if we're looking for the queue
          if (action === 'queue' || submissionId === 'queue' || path.includes('/queue')) {
            console.log('Handling queue request');
            return await getSubmissionQueue(headers);
          }
          
          // Get query parameters for filtering
          const queryParams = event.queryStringParameters || {};
          return await getAllSubmissions(queryParams, headers);
        } else {
          // Students can only see their own submissions
          const queryParams = { 
            ...event.queryStringParameters,
            studentId 
          };
          return await getStudentSubmissions(queryParams, headers);
        }
      }
      
      // GET /part-submissions/{submissionId} - Get a specific submission
      if (httpMethod === 'GET' && submissionId) {
        return await getSubmissionById(submissionId, userId, userRole, studentId, headers);
      }
      
      // POST /part-submissions/presigned-url is now handled by the special case above
      
      // POST /part-submissions - Create a new submission
      if (httpMethod === 'POST' && !submissionId) {
        const body = JSON.parse(event.body || '{}');
        return await createSubmission(body, userId, studentId, headers, userRole);
      }
      
      // PUT /part-submissions/{submissionId} - Update a submission (e.g., approve/reject)
      if (httpMethod === 'PUT' && submissionId) {
        console.log('PUT request for submission:', submissionId);
        
        // Only staff can update submissions
        if (userRole !== 'staff') {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Access denied - Staff only' })
          };
        }
        
        const body = JSON.parse(event.body || '{}');
        console.log('Update submission body:', body);
        
        try {
          return await updateSubmission(submissionId, body, userId, headers);
        } catch (error) {
          console.error('Error in updateSubmission:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update submission', details: error.message })
          };
        }
      }
    }
    
    // If no route matches
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// Get a presigned URL for uploading a video
async function getPresignedUrl(body, userId, studentId, headers) {
  try {
    const { fileName, fileType, labId, partId } = body;
    
    if (!fileName || !fileType || !labId || !partId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: fileName, fileType, labId, partId' })
      };
    }
    
    // Generate a unique file key
    const fileKey = `${labId}/${partId}/${studentId}/${uuidv4()}-${fileName}`;
    
    // Generate a presigned URL for uploading the file
    const params = {
      Bucket: CHECKOFF_VIDEO_BUCKET,
      Key: fileKey,
      ContentType: fileType,
      Expires: 300 // URL expires in 5 minutes
    };
    
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl,
        fileKey
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate upload URL' })
    };
  }
}

// Create a new submission
async function createSubmission(body, userId, studentId, headers, userRole) {
  try {
    const { labId, partId, fileKey, notes } = body;
    
    if (!labId || !partId || !fileKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: labId, partId, fileKey' })
      };
    }
    
    // Get student info or use default values for staff users
    let username = studentId;
    
    // Check if this is a student (not staff)
    if (userRole !== 'staff') {
      const studentParams = {
        TableName: STUDENTS_TABLE,
        Key: {
          name: studentId
        }
      };
      
      const studentResult = await dynamodb.get(studentParams).promise();
      const student = studentResult.Item;
      
      if (!student) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Student not found' })
        };
      }
      
      username = student.name;
    } else {
      console.log('Staff user uploading video, using default values');
    }
    
    // Generate a presigned URL for viewing the video
    const s3Params = {
      Bucket: CHECKOFF_VIDEO_BUCKET,
      Key: fileKey,
      Expires: 604800 // URL expires in 7 days
    };
    
    const videoUrl = await s3.getSignedUrlPromise('getObject', s3Params);
    
    // Create a new submission record
    const timestamp = new Date().toISOString();
    const submissionId = uuidv4();
    
    const submission = {
      submissionId,
      labId,
      partId,
      studentId,
      userId,
      username, // Use the username variable which works for both students and staff
      fileKey,
      videoUrl,
      notes: notes || '',
      status: 'pending',
      submittedAt: timestamp,
      updatedAt: timestamp,
      queuePosition: 0 // Will be updated by a queue processor
    };
    
    const params = {
      TableName: PART_SUBMISSIONS_TABLE,
      Item: submission
    };
    
    await dynamodb.put(params).promise();
    
    // Update the lab progress record to indicate a submission is pending
    const progressId = `${labId}#${partId}`;
    
    const progressParams = {
      TableName: LAB_PROGRESS_TABLE,
      Item: {
        studentId,
        progressId,
        labId,
        partId,
        submissionId,
        checkoffType: 'video',
        completed: false,
        submissionStatus: 'pending',
        updatedAt: timestamp
      }
    };
    
    await dynamodb.put(progressParams).promise();
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        submissionId,
        message: 'Submission created successfully'
      })
    };
  } catch (error) {
    console.error('Error creating submission:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create submission' })
    };
  }
}

// Get all submissions with optional filtering
async function getAllSubmissions(queryParams, headers) {
  try {
    const { labId, partId, status, studentId } = queryParams;
    
    // Base scan parameters
    let params = {
      TableName: PART_SUBMISSIONS_TABLE
    };
    
    // Apply filters if provided
    if (labId || partId || status || studentId) {
      let filterExpression = [];
      let expressionAttributeValues = {};
      let expressionAttributeNames = {};
      
      if (labId) {
        filterExpression.push('#labId = :labId');
        expressionAttributeValues[':labId'] = labId;
        expressionAttributeNames['#labId'] = 'labId';
      }
      
      if (partId) {
        filterExpression.push('#partId = :partId');
        expressionAttributeValues[':partId'] = partId;
        expressionAttributeNames['#partId'] = 'partId';
      }
      
      if (status) {
        filterExpression.push('#status = :status');
        expressionAttributeValues[':status'] = status;
        expressionAttributeNames['#status'] = 'status';
      }
      
      if (studentId) {
        filterExpression.push('#studentId = :studentId');
        expressionAttributeValues[':studentId'] = studentId;
        expressionAttributeNames['#studentId'] = 'studentId';
      }
      
      params.FilterExpression = filterExpression.join(' AND ');
      params.ExpressionAttributeValues = expressionAttributeValues;
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
    
    const result = await dynamodb.scan(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error getting submissions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve submissions' })
    };
  }
}

// Get submissions for a specific student
async function getStudentSubmissions(queryParams, headers) {
  try {
    const { studentId, labId } = queryParams;
    
    if (!studentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameter: studentId' })
      };
    }
    
    // Query parameters
    let params = {
      TableName: PART_SUBMISSIONS_TABLE,
      IndexName: 'StudentIndex',
      KeyConditionExpression: 'studentId = :studentId',
      ExpressionAttributeValues: {
        ':studentId': studentId
      }
    };
    
    // Add labId filter if provided
    if (labId) {
      params.FilterExpression = 'labId = :labId';
      params.ExpressionAttributeValues[':labId'] = labId;
    }
    
    const result = await dynamodb.query(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error getting student submissions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve student submissions' })
    };
  }
}

// Get a specific submission by ID
async function getSubmissionById(submissionId, userId, userRole, studentId, headers) {
  try {
    const params = {
      TableName: PART_SUBMISSIONS_TABLE,
      Key: {
        submissionId
      }
    };
    
    const result = await dynamodb.get(params).promise();
    const submission = result.Item;
    
    if (!submission) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Submission not found' })
      };
    }
    
    // Students can only view their own submissions
    if (userRole !== 'staff' && submission.studentId !== studentId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied - You can only view your own submissions' })
      };
    }
    
    // Generate a fresh presigned URL for viewing the video
    const s3Params = {
      Bucket: CHECKOFF_VIDEO_BUCKET,
      Key: submission.fileKey,
      Expires: 3600 // URL expires in 1 hour
    };
    
    submission.videoUrl = await s3.getSignedUrlPromise('getObject', s3Params);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(submission)
    };
  } catch (error) {
    console.error('Error getting submission:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve submission' })
    };
  }
}

// Update a submission (approve/reject)
async function updateSubmission(submissionId, body, userId, headers) {
  try {
    console.log('updateSubmission called with submissionId:', submissionId);
    console.log('updateSubmission body:', body);
    
    const { status, feedback } = body;
    
    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      console.log('Invalid status:', status);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid status. Must be "approved", "rejected", or "pending"' })
      };
    }
    
    // Get the current submission
    const getParams = {
      TableName: PART_SUBMISSIONS_TABLE,
      Key: {
        submissionId
      }
    };
    
    console.log('Getting submission with params:', getParams);
    const result = await dynamodb.get(getParams).promise();
    console.log('Get submission result:', result);
    
    const submission = result.Item;
    
    if (!submission) {
      console.log('Submission not found for ID:', submissionId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Submission not found' })
      };
    }
    
    console.log('Found submission:', submission);
    
    // Update the submission
    const timestamp = new Date().toISOString();
    
    const updateParams = {
      TableName: PART_SUBMISSIONS_TABLE,
      Key: {
        submissionId
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, reviewedBy = :reviewedBy, reviewedAt = :reviewedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': timestamp,
        ':reviewedBy': userId,
        ':reviewedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    };
    
    // Add feedback if provided
    if (feedback) {
      updateParams.UpdateExpression += ', feedback = :feedback';
      updateParams.ExpressionAttributeValues[':feedback'] = feedback;
    }
    
    console.log('Updating submission with params:', updateParams);
    const updateResult = await dynamodb.update(updateParams).promise();
    console.log('Update submission result:', updateResult);
    
    // Update the lab progress record
    const progressParams = {
      TableName: LAB_PROGRESS_TABLE,
      Key: {
        studentId: submission.studentId,
        progressId: `${submission.labId}#${submission.partId}`
      },
      UpdateExpression: 'SET submissionStatus = :status, updatedAt = :updatedAt, completed = :completed',
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': timestamp,
        ':completed': status === 'approved'
      }
    };
    
    // Add feedback if provided
    if (feedback) {
      progressParams.UpdateExpression += ', feedback = :feedback';
      progressParams.ExpressionAttributeValues[':feedback'] = feedback;
    }
    
    console.log('Updating lab progress with params:', progressParams);
    try {
      const progressResult = await dynamodb.update(progressParams).promise();
      console.log('Update lab progress result:', progressResult);
    } catch (error) {
      console.error('Error updating lab progress:', error);
      // Continue even if lab progress update fails
      // We don't want to fail the whole operation just because the lab progress update failed
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updateResult.Attributes)
    };
  } catch (error) {
    console.error('Error updating submission:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update submission' })
    };
  }
}

// Get the submission queue for staff review
async function getSubmissionQueue(headers) {
  try {
    // Query for pending submissions, sorted by submission time
    const params = {
      TableName: PART_SUBMISSIONS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'pending'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    // Sort by submission time (oldest first)
    const queue = result.Items.sort((a, b) => 
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );
    
    // Get total counts
    const countParams = {
      TableName: PART_SUBMISSIONS_TABLE,
      Select: 'COUNT'
    };
    
    const countResult = await dynamodb.scan(countParams).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: queue,
        totalCount: countResult.Count,
        pendingCount: queue.length
      })
    };
  } catch (error) {
    console.error('Error getting submission queue:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve submission queue' })
    };
  }
}