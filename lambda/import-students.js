const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });

// Initialize DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names
const STUDENTS_TABLE = 'ece4180-students';
const LAB_STATUS_TABLE = 'ece4180-lab-status-v2';
const LAB_PROGRESS_TABLE = 'ece4180-lab-progress';
const LAB_GRADES_TABLE = 'ece4180-lab-grades';

// Load students from JSON file
async function loadStudentsData(filePath) {
  try {
    // Read the file
    const data = fs.readFileSync(filePath, 'utf8');
    const students = JSON.parse(data);
    
    console.log(`Loaded ${students.length} students from JSON file`);
    return students;
  } catch (error) {
    console.error('Error loading students data:', error);
    throw error;
  }
}

// Import students to DynamoDB
async function importStudents(students) {
  console.log(`Importing ${students.length} students to DynamoDB...`);
  
  const importPromises = students.map(async (student) => {
    // Add additional fields to the student object
    const studentItem = {
      ...student,
      hasAccount: false, // Default to false until they create an account
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const params = {
      TableName: STUDENTS_TABLE,
      Item: studentItem
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`Imported student: ${student.name} (Section ${student.section})`);
      
      // For each student, also initialize lab status for all labs
      // This would need to be updated with the actual lab IDs
      const labIds = ['lab0', 'lab1', 'lab2', 'lab3', 'lab4', 'lab5', 'lab6'];
      
      for (const labId of labIds) {
        const timestamp = new Date().toISOString();
        
        // Initialize lab status
        const labStatusParams = {
          TableName: LAB_STATUS_TABLE,
          Item: {
            studentId: student.name,
            labId: labId,
            status: 'locked',
            completed: false,
            updatedAt: timestamp
          }
        };
        
        try {
          await dynamodb.put(labStatusParams).promise();
          console.log(`Initialized lab status for ${student.name}, lab ${labId}`);
          
          // Initialize lab grade (with null grade)
          const labGradeParams = {
            TableName: LAB_GRADES_TABLE,
            Item: {
              studentId: student.name,
              labId: labId,
              grade: null,
              updatedAt: timestamp
            }
          };
          
          await dynamodb.put(labGradeParams).promise();
          console.log(`Initialized lab grade for ${student.name}, lab ${labId}`);
          
          // Initialize lab parts progress
          // For each lab, initialize progress for part1 and part2
          const parts = ['part1', 'part2'];
          
          for (const partId of parts) {
            const progressId = `${labId}#${partId}`;
            const labProgressParams = {
              TableName: LAB_PROGRESS_TABLE,
              Item: {
                studentId: student.name,
                progressId: progressId,
                labId: labId,
                partId: partId,
                completed: false,
                checkoffType: 'pending',
                updatedAt: timestamp
              }
            };
            
            await dynamodb.put(labProgressParams).promise();
            console.log(`Initialized lab progress for ${student.name}, ${labId} ${partId}`);
          }
          
        } catch (error) {
          console.error(`Error initializing data for ${student.name}, lab ${labId}:`, error);
        }
      }
      
      return { success: true, student };
    } catch (error) {
      console.error(`Error importing student ${student.name}:`, error);
      return { success: false, student, error };
    }
  });
  
  const results = await Promise.all(importPromises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Import complete. ${successful} successful, ${failed} failed.`);
  
  return results;
}

// Main function
async function main() {
  try {
    const filePath = path.resolve(__dirname, '../../students.json');
    console.log(`Loading students data from: ${filePath}`);
    
    const students = await loadStudentsData(filePath);
    console.log(`Loaded ${students.length} students from the file.`);
    
    const results = await importStudents(students);
    
    // Print summary
    console.log('\nImport Summary:');
    console.log('---------------');
    console.log(`Total students: ${students.length}`);
    console.log(`Successfully imported: ${results.filter(r => r.success).length}`);
    console.log(`Failed to import: ${results.filter(r => !r.success).length}`);
    
    // Print failures if any
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach(failure => {
        console.log(`- ${failure.student.name}: ${failure.error.message}`);
      });
    }
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  loadStudentsData,
  importStudents
};