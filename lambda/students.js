const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Environment variables from CDK
const STUDENTS_TABLE = process.env.STUDENTS_TABLE || 'ece4180-students';
const LAB_STATUS_TABLE = process.env.LAB_STATUS_TABLE || 'ece4180-lab-status-v2';
const LAB_PROGRESS_TABLE = process.env.LAB_PROGRESS_TABLE || 'ece4180-lab-progress';
const LAB_GRADES_TABLE = process.env.LAB_GRADES_TABLE || 'ece4180-lab-grades';
const LABS_TABLE = process.env.LABS_TABLE || 'ece4180-labs-v1';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'ece4180-submissions';

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
        const name = payload['custom:name'];

        // Log user role for debugging
        console.log('User role:', userRole);
        console.log('User ID:', userId);
        console.log('Name:', name);
        
        // Only staff can access these endpoints
        if (userRole !== 'staff') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Access denied - Staff only' })
            };
        }

        // Route the request based on the HTTP method and path
        const { httpMethod, path } = event;
        const pathParts = path.split('/');
        const resource = pathParts[1]; // 'students' or 'progress'
        
        // Get student name from path
        let studentName = null;
        if (pathParts.length > 2) {
            // Path structure: /resource/{studentName}
            studentName = decodeURIComponent(pathParts[2]);
        }

        if (resource === 'students') {
            // GET /students - List all students
            if (httpMethod === 'GET' && !studentName) {
                return await getAllStudents(headers);
            }
            
            // GET /students/{studentName} - Get a specific student
            if (httpMethod === 'GET' && studentName) {
                return await getStudentById(studentName, headers);
            }
            
            // POST /students - Create a new student
            if (httpMethod === 'POST') {
                const body = JSON.parse(event.body || '{}');
                return await createStudent(body, headers);
            }
            
            // PUT /students/{studentName} - Update a student
            if (httpMethod === 'PUT' && studentName) {
                const body = JSON.parse(event.body || '{}');
                return await updateStudent(studentName, body, headers);
            }
        }
        
        if (resource === 'progress') {
            // GET /progress - Get progress for all students
            if (httpMethod === 'GET' && !studentName) {
                return await getAllProgress(headers);
            }
            
            // GET /progress/{studentName} - Get progress for a specific student
            if (httpMethod === 'GET' && studentName) {
                return await getProgressByStudentId(studentName, headers);
            }
            
            // PUT /progress/{studentName} - Update progress for a student
            if (httpMethod === 'PUT' && studentName) {
                const body = JSON.parse(event.body || '{}');
                return await updateProgress(studentName, body, headers);
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
        
        // Log detailed error information
        console.error('Event:', JSON.stringify(event));
        console.error('Environment variables:', {
            STUDENTS_TABLE,
            LAB_STATUS_TABLE,
            LAB_PROGRESS_TABLE,
            LAB_GRADES_TABLE,
            LABS_TABLE,
            SUBMISSIONS_TABLE
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                stack: error.stack
            })
        };
    }
};

// Get all students
async function getAllStudents(headers) {
    try {
        console.log('Getting all students');
        
        console.log('STUDENTS_TABLE:', STUDENTS_TABLE);
        console.log('Environment variables:', {
            STUDENTS_TABLE,
            LAB_STATUS_TABLE,
            LAB_PROGRESS_TABLE,
            LAB_GRADES_TABLE,
            LABS_TABLE,
            SUBMISSIONS_TABLE
        });
        
        // Get all students from the database
        const params = {
            TableName: STUDENTS_TABLE,
        };
        
        console.log('Scanning students table with params:', JSON.stringify(params));
        
        try {
            const result = await dynamodb.scan(params).promise();
            console.log('Scan result:', JSON.stringify(result));
            const students = result.Items || [];
            console.log(`Found ${students.length} students`);
            
            // Return basic student data without progress to avoid 502 errors
            const basicStudentData = students.map(student => ({
                ...student,
                hasAccount: student.hasAccount || false,
                progressSummary: {
                    completedLabs: 0,
                    totalLabs: 7,
                    overallProgress: 0
                }
            }));
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(basicStudentData)
            };
        } catch (scanError) {
            console.error('Error scanning students table:', scanError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to scan students table', details: scanError.message })
            };
        }
    } catch (error) {
        console.error('Error getting students:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to retrieve students',
                message: error.message,
                stack: error.stack
            })
        };
    }
}

// Get a specific student by ID
async function getStudentById(studentName, headers) {
    try {
        // Get the student from the database
        const params = {
            TableName: STUDENTS_TABLE,
            Key: {
                name: studentName
            }
        };
        
        const result = await dynamodb.get(params).promise();
        const student = result.Item;
        
        if (!student) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Student not found' })
            };
        }
        
        // Get the student's detailed progress
        const progress = await getStudentDetailedProgress(student.name);
        
        // Get account status (simplified here)
        const hasAccount = student.hasAccount || false;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                ...student,
                hasAccount,
                progress
            })
        };
    } catch (error) {
        console.error('Error getting student:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to retrieve student' })
        };
    }
}

// Create a new student
async function createStudent(studentData, headers) {
    try {
        // Validate required fields
        if (!studentData.name || !studentData.section) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: name, section' })
            };
        }
        
        // Check if student already exists
        const checkParams = {
            TableName: STUDENTS_TABLE,
            Key: {
                name: studentData.name
            }
        };
        
        const existingStudent = await dynamodb.get(checkParams).promise();
        if (existingStudent.Item) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ error: 'Student already exists' })
            };
        }
        
        // Create the student record
        const timestamp = new Date().toISOString();
        const student = {
            ...studentData,
            hasAccount: studentData.hasAccount || false,
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        const params = {
            TableName: STUDENTS_TABLE,
            Item: student
        };
        
        await dynamodb.put(params).promise();
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify(student)
        };
    } catch (error) {
        console.error('Error creating student:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create student' })
        };
    }
}

// Update a student
async function updateStudent(name, studentData, headers) {
    try {
        // Check if student exists
        const checkParams = {
            TableName: STUDENTS_TABLE,
            Key: {
                name: name
            }
        };
        
        const existingStudent = await dynamodb.get(checkParams).promise();
        if (!existingStudent.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Student not found' })
            };
        }
        
        // Update the student record
        const timestamp = new Date().toISOString();
        
        // Build update expression dynamically
        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = {
            ':updatedAt': timestamp
        };
        
        // Add all fields from studentData to the update expression
        Object.keys(studentData).forEach((key, index) => {
            // Skip name as it's the primary key
            if (key !== 'name') {
                updateExpression += `, #${key} = :${key}`;
                expressionAttributeValues[`:${key}`] = studentData[key];
            }
        });
        
        // Create expression attribute names for all fields
        const expressionAttributeNames = {};
        Object.keys(studentData).forEach((key) => {
            if (key !== 'name') {
                expressionAttributeNames[`#${key}`] = key;
            }
        });
        
        const params = {
            TableName: STUDENTS_TABLE,
            Key: {
                name: name
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.update(params).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Attributes)
        };
    } catch (error) {
        console.error('Error updating student:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update student' })
        };
    }
}

// Get progress for all students
async function getAllProgress(headers) {
    try {
        console.log('Getting all progress');
        
        // Get all students
        const studentsParams = {
            TableName: STUDENTS_TABLE,
        };
        
        console.log('Scanning students table with params:', JSON.stringify(studentsParams));
        const studentsResult = await dynamodb.scan(studentsParams).promise();
        console.log('Students result:', JSON.stringify(studentsResult));
        const students = studentsResult.Items || [];
        console.log(`Found ${students.length} students`);
        
        // Get all labs
        const labsParams = {
            TableName: LABS_TABLE,
        };
        
        const labsResult = await dynamodb.scan(labsParams).promise();
        const labs = labsResult.Items || [];
        
        // Sort labs by order
        labs.sort((a, b) => a.order - b.order);
        
        // For each student, get their progress for each lab
        const progressData = await Promise.all(students.map(async (student) => {
            const labProgress = await Promise.all(labs.map(async (lab) => {
                // Get lab status
                const statusParams = {
                    TableName: LAB_STATUS_TABLE,
                    Key: {
                        studentId: student.name,
                        labId: lab.labId
                    }
                };
                
                const statusResult = await dynamodb.get(statusParams).promise();
                const status = statusResult.Item || { 
                    status: 'locked', 
                    completed: false 
                };
                
                // Get lab grade
                const gradeParams = {
                    TableName: LAB_GRADES_TABLE,
                    Key: {
                        studentId: student.name,
                        labId: lab.labId
                    }
                };
                
                const gradeResult = await dynamodb.get(gradeParams).promise();
                const grade = gradeResult.Item || { grade: null };
                
                // Get detailed progress for lab parts
                const progressParams = {
                    TableName: LAB_PROGRESS_TABLE,
                    KeyConditionExpression: 'studentId = :studentId AND begins_with(progressId, :labPrefix)',
                    ExpressionAttributeValues: {
                        ':studentId': student.name,
                        ':labPrefix': `${lab.labId}#`
                    }
                };
                
                const progressResult = await dynamodb.query(progressParams).promise();
                const parts = progressResult.Items || [];
                
                return {
                    labId: lab.labId,
                    title: lab.title,
                    status: status.status,
                    completed: status.completed,
                    grade: grade.grade,
                    parts: parts
                };
            }));
            
            return {
                name: student.name,
                section: student.section,
                hasAccount: student.hasAccount || false,
                labs: labProgress
            };
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(progressData)
        };
    } catch (error) {
        console.error('Error getting progress:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to retrieve progress data' })
        };
    }
}

// Get progress for a specific student
async function getProgressByStudentId(studentName, headers) {
    try {
        // Check if student exists
        const studentParams = {
            TableName: STUDENTS_TABLE,
            Key: {
                name: studentName
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
        
        // Get all labs
        const labsParams = {
            TableName: LABS_TABLE,
        };
        
        const labsResult = await dynamodb.scan(labsParams).promise();
        const labs = labsResult.Items || [];
        
        // Sort labs by order
        labs.sort((a, b) => a.order - b.order);
        
        // Get progress for each lab
        const labProgress = await Promise.all(labs.map(async (lab) => {
            // Get lab status
            const statusParams = {
                TableName: LAB_STATUS_TABLE,
                Key: {
                    studentId: studentName,
                    labId: lab.labId
                }
            };
            
            const statusResult = await dynamodb.get(statusParams).promise();
            const status = statusResult.Item || { 
                status: 'locked', 
                completed: false 
            };
            
            // Get lab grade
            const gradeParams = {
                TableName: LAB_GRADES_TABLE,
                Key: {
                    studentId: studentName,
                    labId: lab.labId
                }
            };
            
            const gradeResult = await dynamodb.get(gradeParams).promise();
            const grade = gradeResult.Item || { grade: null };
            
            // Get detailed progress for lab parts
            const progressParams = {
                TableName: LAB_PROGRESS_TABLE,
                KeyConditionExpression: 'studentId = :studentId AND begins_with(progressId, :labPrefix)',
                ExpressionAttributeValues: {
                    ':studentId': studentName,
                    ':labPrefix': `${lab.labId}#`
                }
            };
            
            const progressResult = await dynamodb.query(progressParams).promise();
            const parts = progressResult.Items || [];
            
            // Get submissions for this lab
            const submissionsParams = {
                TableName: SUBMISSIONS_TABLE,
                IndexName: 'StudentIndex',
                KeyConditionExpression: 'name = :name',
                FilterExpression: 'labId = :labId',
                ExpressionAttributeValues: {
                    ':name': studentName,
                    ':labId': lab.labId
                }
            };
            
            const submissionsResult = await dynamodb.query(submissionsParams).promise();
            const submissions = submissionsResult.Items || [];
            
            return {
                labId: lab.labId,
                title: lab.title,
                status: status.status,
                completed: status.completed,
                grade: grade.grade,
                parts: parts,
                submissions: submissions
            };
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                student,
                labs: labProgress
            })
        };
    } catch (error) {
        console.error('Error getting student progress:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to retrieve student progress' })
        };
    }
}

// Update progress for a student
async function updateProgress(name, progressData, headers) {
    try {
        // Check if student exists
        const studentParams = {
            TableName: STUDENTS_TABLE,
            Key: {
                name
            }
        };
        
        const studentResult = await dynamodb.get(studentParams).promise();
        if (!studentResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Student not found' })
            };
        }
        
        const { labId, partId, status, completed, grade, checkoffType } = progressData;
        
        if (!labId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required field: labId' })
            };
        }
        
        const timestamp = new Date().toISOString();
        const updates = [];
        
        // Update lab status if provided
        if (status !== undefined || completed !== undefined) {
            const statusParams = {
                TableName: LAB_STATUS_TABLE,
                Key: {
                    studentId: name,
                    labId
                },
                UpdateExpression: 'SET updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':updatedAt': timestamp
                },
                ReturnValues: 'ALL_NEW'
            };
            
            if (status !== undefined) {
                statusParams.UpdateExpression += ', #status = :status';
                statusParams.ExpressionAttributeValues[':status'] = status;
                if (!statusParams.ExpressionAttributeNames) {
                    statusParams.ExpressionAttributeNames = {};
                }
                statusParams.ExpressionAttributeNames['#status'] = 'status';
            }
            
            if (completed !== undefined) {
                statusParams.UpdateExpression += ', completed = :completed';
                statusParams.ExpressionAttributeValues[':completed'] = completed;
            }
            
            const statusResult = await dynamodb.update(statusParams).promise();
            updates.push({ type: 'status', result: statusResult.Attributes });
        }
        
        // Update lab grade if provided
        if (grade !== undefined) {
            const gradeParams = {
                TableName: LAB_GRADES_TABLE,
                Key: {
                    studentId: name,
                    labId
                },
                UpdateExpression: 'SET grade = :grade, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':grade': grade,
                    ':updatedAt': timestamp
                },
                ReturnValues: 'ALL_NEW'
            };
            
            // Use put instead of update to create if not exists
            const gradeItem = {
                studentId: name,
                labId,
                grade,
                updatedAt: timestamp
            };
            
            const gradePutParams = {
                TableName: LAB_GRADES_TABLE,
                Item: gradeItem
            };
            
            await dynamodb.put(gradePutParams).promise();
            updates.push({ type: 'grade', result: gradeItem });
        }
        
        // Update part progress if partId is provided
        if (partId) {
            const progressId = `${labId}#${partId}`;
            
            // Check if progress record exists
            const checkParams = {
                TableName: LAB_PROGRESS_TABLE,
                Key: {
                    studentId: name,
                    progressId
                }
            };
            
            const existingProgress = await dynamodb.get(checkParams).promise();
            
            // Create or update progress record
            const progressItem = {
                studentId: name,
                progressId,
                labId,
                partId,
                completed: completed !== undefined ? completed : (existingProgress.Item?.completed || false),
                checkoffType: checkoffType || existingProgress.Item?.checkoffType || 'pending',
                updatedAt: timestamp
            };
            
            const progressParams = {
                TableName: LAB_PROGRESS_TABLE,
                Item: progressItem
            };
            
            await dynamodb.put(progressParams).promise();
            updates.push({ type: 'progress', result: progressItem });
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Progress updated successfully',
                updates
            })
        };
    } catch (error) {
        console.error('Error updating progress:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update progress' })
        };
    }
}

// Helper function to get a student's progress summary
async function getStudentProgressSummary(name) {
    try {
        // Get all labs
        const labsParams = {
            TableName: LABS_TABLE,
        };
        
        const labsResult = await dynamodb.scan(labsParams).promise();
        const labs = labsResult.Items || [];
        
        // Get lab status for each lab
        const statusPromises = labs.map(async (lab) => {
            const statusParams = {
                TableName: LAB_STATUS_TABLE,
                Key: {
                    studentId: name,
                    labId: lab.labId
                }
            };
            
            const statusResult = await dynamodb.get(statusParams).promise();
            return statusResult.Item || { 
                labId: lab.labId,
                status: 'locked',
                completed: false
            };
        });
        
        const statuses = await Promise.all(statusPromises);
        
        // Get lab grades
        const gradesPromises = labs.map(async (lab) => {
            const gradeParams = {
                TableName: LAB_GRADES_TABLE,
                Key: {
                    studentId: name,
                    labId: lab.labId
                }
            };
            
            const gradeResult = await dynamodb.get(gradeParams).promise();
            return gradeResult.Item || { 
                labId: lab.labId,
                grade: null
            };
        });
        
        const grades = await Promise.all(gradesPromises);
        
        // Combine status and grade data
        const labSummary = labs.map(lab => {
            const status = statuses.find(s => s.labId === lab.labId) || { status: 'locked', completed: false };
            const grade = grades.find(g => g.labId === lab.labId) || { grade: null };
            
            return {
                labId: lab.labId,
                title: lab.title,
                status: status.status,
                completed: status.completed,
                grade: grade.grade
            };
        });
        
        // Calculate overall progress
        const completedLabs = labSummary.filter(lab => lab.completed).length;
        const totalLabs = labs.length;
        const overallProgress = totalLabs > 0 ? (completedLabs / totalLabs) * 100 : 0;
        
        return {
            completedLabs,
            totalLabs,
            overallProgress,
            labSummary
        };
    } catch (error) {
        console.error('Error getting student progress summary:', error);
        return {
            completedLabs: 0,
            totalLabs: 0,
            overallProgress: 0,
            labSummary: []
        };
    }
}

// Helper function to get a student's detailed progress
async function getStudentDetailedProgress(name) {
    try {
        // Get all labs
        const labsParams = {
            TableName: LABS_TABLE,
        };
        
        const labsResult = await dynamodb.scan(labsParams).promise();
        const labs = labsResult.Items || [];
        
        // Sort labs by order
        labs.sort((a, b) => a.order - b.order);
        
        // Get progress for each lab
        const labProgress = await Promise.all(labs.map(async (lab) => {
            // Get lab status
            const statusParams = {
                TableName: LAB_STATUS_TABLE,
                Key: {
                    studentId: name,
                    labId: lab.labId
                }
            };
            
            const statusResult = await dynamodb.get(statusParams).promise();
            const status = statusResult.Item || { 
                status: 'locked', 
                completed: false 
            };
            
            // Get lab grade
            const gradeParams = {
                TableName: LAB_GRADES_TABLE,
                Key: {
                    studentId: name,
                    labId: lab.labId
                }
            };
            
            const gradeResult = await dynamodb.get(gradeParams).promise();
            const grade = gradeResult.Item || { grade: null };
            
            // Get detailed progress for lab parts
            const progressParams = {
                TableName: LAB_PROGRESS_TABLE,
                KeyConditionExpression: 'studentId = :studentId AND begins_with(progressId, :labPrefix)',
                ExpressionAttributeValues: {
                    ':studentId': name,
                    ':labPrefix': `${lab.labId}#`
                }
            };
            const progressResult = await dynamodb.query(progressParams).promise();
            const parts = progressResult.Items || [];
            
            return {
                labId: lab.labId,
                title: lab.title,
                status: status.status,
                completed: status.completed,
                grade: grade.grade,
                parts: parts
            };
        }));
        
        return labProgress;
    } catch (error) {
        console.error('Error getting student detailed progress:', error);
        return [];
    }
}