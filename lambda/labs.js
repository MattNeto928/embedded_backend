const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const fs = require('fs');
const path = require('path');

// Environment variables from CDK
const LABS_TABLE = process.env.LABS_TABLE;
const LAB_STATUS_TABLE = process.env.LAB_STATUS_TABLE;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE;

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
    
    console.log('Origin:', origin);
    console.log('Is allowed origin:', isAllowedOrigin);
    console.log('CORS headers:', headers);
    
    // Log the request details for debugging
    console.log('Request headers:', event.headers);
    console.log('Request origin:', origin);
    console.log('Request method:', event.httpMethod);
    console.log('Request path:', event.path);

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
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
                     
        console.log('Token present:', !!token);
        
        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized - No token provided' })
            };
        }

        // Parse the JWT token to get user info (simplified for this example)
        // In a real implementation, you would verify the token with Cognito
        const tokenParts = token.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const userId = payload.sub;
        const userRole = payload['custom:role'] || 'student';
        const studentId = payload['custom:studentId'];

        // Route the request based on the HTTP method and path
        const { httpMethod, path } = event;
        const pathParts = path.split('/');
        const resource = pathParts[1]; // 'labs'
        const labId = pathParts[2]; // Optional lab ID
        const action = pathParts[3]; // Optional action (lock, unlock, submit)

        if (resource === 'labs') {
            // GET /labs - List all labs
            if (httpMethod === 'GET' && !labId) {
                return await getAllLabs(userId, userRole, studentId, headers);
            }
            
            // GET or HEAD /labs/{labId} - Get a specific lab or check access
            if ((httpMethod === 'GET' || httpMethod === 'HEAD') && labId && !action) {
                return await getLabById(labId, userId, userRole, studentId, headers, httpMethod);
            }
            
            // PUT /labs/{labId} - Update lab content (staff only)
            if (httpMethod === 'PUT' && labId && !action) {
                if (userRole !== 'staff') {
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ error: 'Only staff can update lab content' })
                    };
                }
                const body = JSON.parse(event.body || '{}');
                return await updateLabContent(labId, body, headers);
            }
            
            // POST /labs/{labId}/unlock - Unlock a lab for all students
            if (httpMethod === 'POST' && labId && action === 'unlock') {
                if (userRole !== 'staff') {
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ error: 'Only staff can unlock labs for all students' })
                    };
                }
                return await unlockLabForAll(labId, headers);
            }
            
            // POST /labs/{labId}/lock - Lock a lab for all students
            if (httpMethod === 'POST' && labId && action === 'lock') {
                if (userRole !== 'staff') {
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ error: 'Only staff can lock labs for all students' })
                    };
                }
                return await lockLabForAll(labId, headers);
            }
            
            // POST /labs/{labId}/submit - Submit a lab
            if (httpMethod === 'POST' && labId && action === 'submit') {
                const body = JSON.parse(event.body || '{}');
                return await submitLab(labId, userId, studentId, body, headers);
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
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// Get all labs with status for the current user
async function getAllLabs(userId, userRole, studentId, headers) {
    try {
        // Get all labs from the database
        const labsParams = {
            TableName: LABS_TABLE,
        };
        
        const labsResult = await dynamodb.scan(labsParams).promise();
        const labs = labsResult.Items || [];
        
        // Sort labs by order
        labs.sort((a, b) => a.order - b.order);
        
        // If user is a student, get their lab status
        if (userRole === 'student' && studentId) {
            // Get lab status for this student
            const statusPromises = labs.map(async (lab) => {
                const statusParams = {
                    TableName: LAB_STATUS_TABLE,
                    Key: {
                        studentId,
                        labId: lab.labId
                    }
                };
                
                try {
                    const statusResult = await dynamodb.get(statusParams).promise();
                    const status = statusResult.Item;
                    
                    // Merge lab data with status
                    // Use the locked field from the lab record, with a default if not present
                    const isLocked = lab.locked !== undefined ? lab.locked : (lab.labId !== 'lab1');
                    return {
                        ...lab,
                        locked: isLocked,
                        status: isLocked ? 'locked' : 'unlocked',
                        completed: status ? status.completed : false
                    };
                } catch (error) {
                    console.error(`Error getting status for lab ${lab.labId}:`, error);
                    return {
                        ...lab,
                        locked: lab.labId !== 'lab1', // Lab 1 is unlocked by default
                        status: lab.labId === 'lab1' ? 'unlocked' : 'locked',
                        completed: false
                    };
                }
            });
            
            const labsWithStatus = await Promise.all(statusPromises);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(labsWithStatus)
            };
        }
        
        // For staff, return all labs with their actual locked status
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(labs.map(lab => {
                const isLocked = lab.locked !== undefined ? lab.locked : (lab.labId !== 'lab1');
                return {
                    ...lab,
                    locked: isLocked, // Use the actual locked status
                    status: isLocked ? 'locked' : 'unlocked'
                };
            }))
        };
    } catch (error) {
        console.error('Error getting labs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to retrieve labs' })
        };
    }
}

// Get a specific lab by ID or check access with HEAD
async function getLabById(labId, userId, userRole, studentId, headers, httpMethod = 'GET') {
    try {
        // Get the lab from the database
        const labParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            }
        };
        
        const labResult = await dynamodb.get(labParams).promise();
        const lab = labResult.Item;
        
        if (!lab) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Lab not found' })
            };
        }
        
        // If user is a student, check if they have access to this lab
        if (userRole === 'student' && studentId) {
            // Get lab status for this student
            const statusParams = {
                TableName: LAB_STATUS_TABLE,
                Key: {
                    studentId,
                    labId
                }
            };
            
            const statusResult = await dynamodb.get(statusParams).promise();
            const status = statusResult.Item;
            
            // Check if lab is locked using the locked field from the lab record
            const isLocked = lab.locked !== undefined ? lab.locked : (labId !== 'lab1');
            
            if (isLocked) {
                console.log(`Student ${studentId} attempted to access locked lab ${labId} with ${httpMethod} request`);
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({
                        error: 'Access denied',
                        message: 'This lab is currently locked. Please wait for your instructor to unlock it.',
                        labId: labId,
                        locked: true
                    })
                };
            }
            
            // For HEAD requests, just return status code without body
            if (httpMethod === 'HEAD') {
                return {
                    statusCode: 200,
                    headers
                };
            }
            
            // Return lab with status for GET requests
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    ...lab,
                    locked: isLocked,
                    status: isLocked ? 'locked' : 'unlocked',
                    completed: status ? status.completed : false
                })
            };
        }
        
        // For staff, return the lab with its actual locked status
        const isLocked = lab.locked !== undefined ? lab.locked : (labId !== 'lab1');
        
        // For HEAD requests, just return status code without body
        if (httpMethod === 'HEAD') {
            return {
                statusCode: 200,
                headers
            };
        }
        
        // Return lab details for GET requests
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...lab,
                locked: isLocked,
                status: isLocked ? 'locked' : 'unlocked'
            })
        };
    } catch (error) {
        console.error('Error getting lab:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to retrieve lab' })
        };
    }
}

// Unlock a lab for all students
async function unlockLabForAll(labId, headers) {
    try {
        // First, check if the lab exists
        const labParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            }
        };
        
        const labResult = await dynamodb.get(labParams).promise();
        if (!labResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Lab not found' })
            };
        }
        
        // Update the locked field in the LABS_TABLE
        const updateParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            },
            UpdateExpression: 'SET locked = :locked, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':locked': false,
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const updateResult = await dynamodb.update(updateParams).promise();
        console.log(`Unlocked lab ${labId}:`, updateResult.Attributes);
        
        // Get all student status records for this lab and update them
        // This ensures the lab status is consistent across all tables
        try {
            // Query for all student status records for this lab
            const queryParams = {
                TableName: LAB_STATUS_TABLE,
                IndexName: 'labId-index', // Assuming there's a GSI on labId
                KeyConditionExpression: 'labId = :labId',
                ExpressionAttributeValues: {
                    ':labId': labId
                }
            };
            
            const statusRecords = await dynamodb.query(queryParams).promise();
            
            // Update each student's status record
            if (statusRecords.Items && statusRecords.Items.length > 0) {
                const updatePromises = statusRecords.Items.map(record => {
                    const updateStatusParams = {
                        TableName: LAB_STATUS_TABLE,
                        Key: {
                            studentId: record.studentId,
                            labId: record.labId
                        },
                        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
                        ExpressionAttributeNames: {
                            '#status': 'status'
                        },
                        ExpressionAttributeValues: {
                            ':status': 'unlocked',
                            ':updatedAt': new Date().toISOString()
                        }
                    };
                    return dynamodb.update(updateStatusParams).promise();
                });
                
                await Promise.all(updatePromises);
                console.log(`Updated ${statusRecords.Items.length} student status records for lab ${labId}`);
            }
        } catch (statusError) {
            console.error('Error updating student status records:', statusError);
            // Continue with the response even if updating student records fails
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Lab unlocked for all students',
                lab: updateResult.Attributes
            })
        };
    } catch (error) {
        console.error('Error unlocking lab:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to unlock lab' })
        };
    }
}

// Lock a lab for all students
async function lockLabForAll(labId, headers) {
    try {
        // First, check if the lab exists
        const labParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            }
        };
        
        const labResult = await dynamodb.get(labParams).promise();
        if (!labResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Lab not found' })
            };
        }
        
        // Update the locked field in the LABS_TABLE
        const updateParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            },
            UpdateExpression: 'SET locked = :locked, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':locked': true,
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const updateResult = await dynamodb.update(updateParams).promise();
        console.log(`Locked lab ${labId}:`, updateResult.Attributes);
        
        // Get all student status records for this lab and update them
        // This ensures the lab status is consistent across all tables
        try {
            // Query for all student status records for this lab
            const queryParams = {
                TableName: LAB_STATUS_TABLE,
                IndexName: 'labId-index', // Assuming there's a GSI on labId
                KeyConditionExpression: 'labId = :labId',
                ExpressionAttributeValues: {
                    ':labId': labId
                }
            };
            
            const statusRecords = await dynamodb.query(queryParams).promise();
            
            // Update each student's status record
            if (statusRecords.Items && statusRecords.Items.length > 0) {
                const updatePromises = statusRecords.Items.map(record => {
                    const updateStatusParams = {
                        TableName: LAB_STATUS_TABLE,
                        Key: {
                            studentId: record.studentId,
                            labId: record.labId
                        },
                        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
                        ExpressionAttributeNames: {
                            '#status': 'status'
                        },
                        ExpressionAttributeValues: {
                            ':status': 'locked',
                            ':updatedAt': new Date().toISOString()
                        }
                    };
                    return dynamodb.update(updateStatusParams).promise();
                });
                
                await Promise.all(updatePromises);
                console.log(`Updated ${statusRecords.Items.length} student status records for lab ${labId}`);
            }
        } catch (statusError) {
            console.error('Error updating student status records:', statusError);
            // Continue with the response even if updating student records fails
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Lab locked for all students',
                lab: updateResult.Attributes
            })
        };
    } catch (error) {
        console.error('Error locking lab:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to lock lab' })
        };
    }
}

// Update lab content (staff only)
async function updateLabContent(labId, updatedLabData, headers) {
    try {
        console.log('Updating lab content for lab:', labId);
        console.log('Received data:', JSON.stringify(updatedLabData).substring(0, 200) + '...');
        
        // First, check if the lab exists
        const labParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            }
        };
        
        const labResult = await dynamodb.get(labParams).promise();
        if (!labResult.Item) {
            console.log(`Lab ${labId} not found`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Lab not found' })
            };
        }
        
        console.log('Existing lab found:', labResult.Item.title);
        
        // Ensure required fields are present
        if (!updatedLabData.title || !updatedLabData.description) {
            console.log('Missing required fields');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: title and description are required' })
            };
        }
        
        // Preserve certain fields that shouldn't be modified directly
        const existingLab = labResult.Item;
        const preservedFields = {
            labId: existingLab.labId,
            createdAt: existingLab.createdAt,
            locked: existingLab.locked, // Preserve locked status
        };
        
        // Merge the updated data with preserved fields and add updatedAt timestamp
        const mergedLabData = {
            ...updatedLabData,
            ...preservedFields,
            updatedAt: new Date().toISOString()
        };
        
        // Log detailed information about the structuredContent
        console.log('Saving lab with structuredContent:',
            mergedLabData.structuredContent ? 'Present' : 'Missing');
            
        if (mergedLabData.structuredContent) {
            console.log('Sections count:', mergedLabData.structuredContent.sections?.length || 0);
            console.log('First section title:',
                mergedLabData.structuredContent.sections?.[0]?.title || 'No title');
            console.log('Resources count:',
                mergedLabData.structuredContent.resources?.length || 0);
        }
        
        // Update the lab in DynamoDB
        const updateParams = {
            TableName: LABS_TABLE,
            Item: mergedLabData
        };
        
        await dynamodb.put(updateParams).promise();
        console.log(`Updated lab ${labId} content successfully`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Lab content updated successfully',
                lab: mergedLabData
            })
        };
    } catch (error) {
        console.error('Error updating lab content:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update lab content' })
        };
    }
}

// Submit a lab
async function submitLab(labId, userId, studentId, body, headers) {
    try {
        const { fileKey, notes } = body;
        
        if (!fileKey) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'File key is required' })
            };
        }
        
        // Check if the lab is locked
        const labParams = {
            TableName: LABS_TABLE,
            Key: {
                labId
            }
        };
        
        const labResult = await dynamodb.get(labParams).promise();
        if (!labResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Lab not found' })
            };
        }
        
        // Check if the lab is locked
        const isLocked = labResult.Item.locked !== undefined ? labResult.Item.locked : (labId !== 'lab1');
        if (isLocked) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'This lab is locked and cannot be submitted' })
            };
        }
        
        // Create a new submission
        const submissionId = `${studentId}-${labId}-${Date.now()}`;
        const submission = {
            submissionId,
            labId,
            studentId,
            userId,
            fileKey,
            notes: notes || '',
            status: 'pending',
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save the submission to the database
        const submissionParams = {
            TableName: SUBMISSIONS_TABLE,
            Item: submission
        };
        
        await dynamodb.put(submissionParams).promise();
        
        // Update the lab status to completed
        const statusParams = {
            TableName: LAB_STATUS_TABLE,
            Item: {
                studentId,
                labId,
                status: 'unlocked',
                submissionStatus: 'pending',
                submissionId,
                completed: true,
                updatedAt: new Date().toISOString()
            }
        };
        
        await dynamodb.put(statusParams).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Lab submitted successfully', submissionId })
        };
    } catch (error) {
        console.error('Error submitting lab:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to submit lab' })
        };
    }
}