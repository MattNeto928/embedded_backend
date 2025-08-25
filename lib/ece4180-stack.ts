import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LabContentImporter } from './lab-content-importer';

export class Ece4180Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for general video storage
    const videoBucket = new s3.Bucket(this, 'VideoBucket', {
      bucketName: 'ece4180-lab-videos',
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteOldVideos',
          expiration: cdk.Duration.days(365), // Keep videos for 1 year
        },
      ],
    });
    
    // S3 Bucket for checkoff videos (per lab part)
    const checkoffVideoBucket = new s3.Bucket(this, 'CheckoffVideoBucket', {
      bucketName: 'ece4180-checkoff-videos',
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteOldCheckoffVideos',
          expiration: cdk.Duration.days(365), // Keep videos for 1 year
        },
      ],
    });

    // DynamoDB Tables
    const submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      tableName: 'ece4180-submissions',
      partitionKey: { name: 'submissionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Table for tracking video submissions per lab part
    const partSubmissionsTable = new dynamodb.Table(this, 'PartSubmissionsTable', {
      tableName: 'ece4180-part-submissions',
      partitionKey: { name: 'submissionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Add GSI for querying by student
    partSubmissionsTable.addGlobalSecondaryIndex({
      indexName: 'StudentIndex',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
    });
    
    // Add GSI for querying by lab and part
    partSubmissionsTable.addGlobalSecondaryIndex({
      indexName: 'LabPartIndex',
      partitionKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'partId', type: dynamodb.AttributeType.STRING },
    });
    
    // Add GSI for querying by status (for the queue)
    partSubmissionsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for querying by student
    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'StudentIndex',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for querying by lab and status
    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'LabStatusIndex',
      partitionKey: { name: 'labNumber', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    const labStatusTable = new dynamodb.Table(this, 'LabStatusTable', {
      tableName: 'ece4180-lab-status-v2',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Labs table for storing lab details
    const labsTable = new dynamodb.Table(this, 'LabsTable', {
      tableName: 'ece4180-labs-v1',
      partitionKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Students table for storing student information
    const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
      tableName: 'ece4180-students',
      partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Add GSI for querying by section
    studentsTable.addGlobalSecondaryIndex({
      indexName: 'SectionIndex',
      partitionKey: { name: 'section', type: dynamodb.AttributeType.STRING },
    });
    
    // Lab Progress table for tracking detailed progress on lab parts
    const labProgressTable = new dynamodb.Table(this, 'LabProgressTable', {
      tableName: 'ece4180-lab-progress',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'progressId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Lab Grades table for storing grades for each lab
    const labGradesTable = new dynamodb.Table(this, 'LabGradesTable', {
      tableName: 'ece4180-lab-grades',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Add GSI for querying labs by order
    labsTable.addGlobalSecondaryIndex({
      indexName: 'OrderIndex',
      partitionKey: { name: 'order', type: dynamodb.AttributeType.NUMBER },
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ece4180-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
        studentId: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userSrp: true,
        userPassword: true, // Enable USER_PASSWORD_AUTH flow
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                submissionsTable.tableArn,
                `${submissionsTable.tableArn}/index/*`,
                partSubmissionsTable.tableArn,
                `${partSubmissionsTable.tableArn}/index/*`,
                labStatusTable.tableArn,
                labsTable.tableArn,
                `${labsTable.tableArn}/index/*`,
                studentsTable.tableArn,
                `${studentsTable.tableArn}/index/*`,
                labProgressTable.tableArn,
                labGradesTable.tableArn,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetSignedUrl',
              ],
              resources: [
                `${videoBucket.bucketArn}/*`,
                `${checkoffVideoBucket.bucketArn}/*`
              ],
            }),
          ],
        }),
        CognitoAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
              ],
              resources: [userPool.userPoolArn],
            }),
          ],
        }),
      },
    });

    // Lambda Functions
    const authFunction = new lambda.Function(this, 'AuthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auth.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const labsFunction = new lambda.Function(this, 'LabsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'labs.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      environment: {
        LAB_STATUS_TABLE: labStatusTable.tableName,
        LABS_TABLE: labsTable.tableName,
        SUBMISSIONS_TABLE: submissionsTable.tableName,
        PART_SUBMISSIONS_TABLE: partSubmissionsTable.tableName,
        VIDEO_BUCKET: videoBucket.bucketName,
        CHECKOFF_VIDEO_BUCKET: checkoffVideoBucket.bucketName,
        STUDENTS_TABLE: studentsTable.tableName,
        LAB_PROGRESS_TABLE: labProgressTable.tableName,
        LAB_GRADES_TABLE: labGradesTable.tableName,
      },
    });

    const submissionsFunction = new lambda.Function(this, 'SubmissionsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'submissions.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      environment: {
        SUBMISSIONS_TABLE: submissionsTable.tableName,
        PART_SUBMISSIONS_TABLE: partSubmissionsTable.tableName,
        VIDEO_BUCKET: videoBucket.bucketName,
        CHECKOFF_VIDEO_BUCKET: checkoffVideoBucket.bucketName,
        STUDENTS_TABLE: studentsTable.tableName,
        LAB_PROGRESS_TABLE: labProgressTable.tableName,
        LAB_GRADES_TABLE: labGradesTable.tableName,
      },
    });
    
    // Part Submissions Lambda function
    const partSubmissionsFunction = new lambda.Function(this, 'PartSubmissionsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'part-submissions.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      environment: {
        PART_SUBMISSIONS_TABLE: partSubmissionsTable.tableName,
        CHECKOFF_VIDEO_BUCKET: checkoffVideoBucket.bucketName,
        STUDENTS_TABLE: studentsTable.tableName,
        LAB_PROGRESS_TABLE: labProgressTable.tableName,
        LAB_GRADES_TABLE: labGradesTable.tableName,
      },
    });

    // Students Lambda function
    const studentsFunction = new lambda.Function(this, 'StudentsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'students.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      environment: {
        STUDENTS_TABLE: studentsTable.tableName,
        LAB_STATUS_TABLE: labStatusTable.tableName,
        LAB_PROGRESS_TABLE: labProgressTable.tableName,
        LAB_GRADES_TABLE: labGradesTable.tableName,
        LABS_TABLE: labsTable.tableName,
        SUBMISSIONS_TABLE: submissionsTable.tableName,
        PART_SUBMISSIONS_TABLE: partSubmissionsTable.tableName,
        VIDEO_BUCKET: videoBucket.bucketName,
        CHECKOFF_VIDEO_BUCKET: checkoffVideoBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'Ece4180Api', {
      restApiName: 'ECE 4180 Course API',
      description: 'API for ECE 4180 course platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          ...apigateway.Cors.DEFAULT_HEADERS,
          'Authorization',
          'Content-Type',
          'X-Amz-Date',
          'X-Api-Key'
        ],
        allowCredentials: true,
      },
    });
    
    // Add CORS headers to 4XX error responses
    new apigateway.GatewayResponse(this, 'Default4XX', {
      restApi: api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'",
        'Access-Control-Allow-Methods': "'GET,POST,OPTIONS,PUT'",
        'Access-Control-Allow-Credentials': "'true'"
      }
    });
    
    // Add CORS headers to 5XX error responses
    new apigateway.GatewayResponse(this, 'Default5XX', {
      restApi: api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'",
        'Access-Control-Allow-Methods': "'GET,POST,OPTIONS,PUT'",
        'Access-Control-Allow-Credentials': "'true'"
      }
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // API Routes
    const authResource = api.root.addResource('auth');
    authResource.addMethod('POST', new apigateway.LambdaIntegration(authFunction));

    const labsResource = api.root.addResource('labs');
    labsResource.addMethod('GET', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });

    const labResource = labsResource.addResource('{labId}');
    labResource.addMethod('GET', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });
    labResource.addMethod('POST', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });
    // Add PUT method for updating lab content
    labResource.addMethod('PUT', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });

    const unlockResource = labResource.addResource('unlock');
    unlockResource.addMethod('POST', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });

    const lockResource = labResource.addResource('lock');
    lockResource.addMethod('POST', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });

    const submitResource = labResource.addResource('submit');
    submitResource.addMethod('POST', new apigateway.LambdaIntegration(labsFunction), {
      authorizer,
    });

    // Students API endpoints
    const studentsResource = api.root.addResource('students');
    studentsResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    
    const studentResource = studentsResource.addResource('{studentName}');
    studentResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    studentResource.addMethod('PUT', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    
    // Progress API endpoints
    const progressResource = api.root.addResource('progress');
    progressResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    
    const studentProgressResource = progressResource.addResource('{studentName}');
    studentProgressResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    studentProgressResource.addMethod('PUT', new apigateway.LambdaIntegration(studentsFunction), {
      authorizer,
    });
    
    const submissionsResource = api.root.addResource('submissions');
    submissionsResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsFunction), {
      authorizer,
    });

    const submissionResource = submissionsResource.addResource('{submissionId}');
    submissionResource.addMethod('PUT', new apigateway.LambdaIntegration(submissionsFunction), {
      authorizer,
    });
    
    // Part submissions API endpoints
    const partSubmissionsResource = api.root.addResource('part-submissions');
    partSubmissionsResource.addMethod('GET', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });
    
    // Endpoint for creating a new part submission
    partSubmissionsResource.addMethod('POST', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });
    
    // Endpoint for getting a specific part submission
    const partSubmissionResource = partSubmissionsResource.addResource('{submissionId}');
    partSubmissionResource.addMethod('GET', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });
    
    // Endpoint for updating a part submission (approve/reject)
    partSubmissionResource.addMethod('PUT', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });
    
    // Endpoint for getting the next submission in the queue
    const queueResource = partSubmissionsResource.addResource('queue');
    queueResource.addMethod('GET', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });
    
    // Endpoint for getting a presigned URL for uploading a video
    const presignedUrlResource = partSubmissionsResource.addResource('presigned-url');
    presignedUrlResource.addMethod('POST', new apigateway.LambdaIntegration(partSubmissionsFunction), {
      authorizer,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'VideoBucketName', {
      value: videoBucket.bucketName,
      description: 'S3 Video Bucket Name',
    });
    
    new cdk.CfnOutput(this, 'CheckoffVideoBucketName', {
      value: checkoffVideoBucket.bucketName,
      description: 'S3 Checkoff Video Bucket Name',
    });
    
    // Add the lab content importer to automatically load lab content from JSON files
    // This will preserve the "locked" status of existing labs
    new LabContentImporter(this, 'LabContentImporter', {
      labsTable: labsTable
    });
  }
}
