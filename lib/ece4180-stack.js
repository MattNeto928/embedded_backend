"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ece4180Stack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lab_content_importer_1 = require("./lab-content-importer");
class Ece4180Stack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // S3 Bucket for video storage
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
        // DynamoDB Tables
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
        const submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
            tableName: 'ece4180-submissions',
            partitionKey: { name: 'submissionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
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
        // Labs table for storing lab details
        const labsTable = new dynamodb.Table(this, 'LabsTable', {
            tableName: 'ece4180-labs-v1',
            partitionKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
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
                            resources: [`${videoBucket.bucketArn}/*`],
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
                VIDEO_BUCKET: videoBucket.bucketName,
            },
        });
        const submissionsFunction = new lambda.Function(this, 'SubmissionsFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'submissions.handler',
            code: lambda.Code.fromAsset('lambda'),
            role: lambdaRole,
            environment: {
                SUBMISSIONS_TABLE: submissionsTable.tableName,
                VIDEO_BUCKET: videoBucket.bucketName,
            },
        });
        // API Gateway
        const api = new apigateway.RestApi(this, 'Ece4180Api', {
            restApiName: 'ECE 4180 Course API',
            description: 'API for ECE 4180 course platform',
            defaultCorsPreflightOptions: {
                allowOrigins: [
                    'http://localhost:3000',
                    'https://ece4180.vercel.app',
                    'https://embedded-website-2.vercel.app',
                    'https://embedded-website-2-git-main.vercel.app'
                ],
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
                'Access-Control-Allow-Origin': "'http://localhost:3000,https://ece4180.vercel.app,https://embedded-website-2.vercel.app,https://embedded-website-2-git-main.vercel.app'",
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
                'Access-Control-Allow-Origin': "'http://localhost:3000,https://ece4180.vercel.app,https://embedded-website-2.vercel.app,https://embedded-website-2-git-main.vercel.app'",
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
        // Students API endpoints
        const studentsResource = api.root.addResource('students');
        studentsResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
            authorizer,
        });
        studentsResource.addMethod('POST', new apigateway.LambdaIntegration(studentsFunction), {
            authorizer,
        });
        const studentResource = studentsResource.addResource('{name}');
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
        const studentProgressResource = progressResource.addResource('{name}');
        studentProgressResource.addMethod('GET', new apigateway.LambdaIntegration(studentsFunction), {
            authorizer,
        });
        studentProgressResource.addMethod('PUT', new apigateway.LambdaIntegration(studentsFunction), {
            authorizer,
        });
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
        const submissionsResource = api.root.addResource('submissions');
        submissionsResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsFunction), {
            authorizer,
        });
        const submissionResource = submissionsResource.addResource('{submissionId}');
        submissionResource.addMethod('PUT', new apigateway.LambdaIntegration(submissionsFunction), {
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
        // Add the lab content importer to automatically load lab content from JSON files
        // This will preserve the "locked" status of existing labs
        new lab_content_importer_1.LabContentImporter(this, 'LabContentImporter', {
            labsTable: labsTable
        });
    }
}
exports.Ece4180Stack = Ece4180Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNlNDE4MC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVjZTQxODAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHVFQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6Qyx5REFBMkM7QUFFM0MsaUVBQTREO0FBRTVELE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsOEJBQThCO1FBQzlCLE1BQU0sV0FBVyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JELFVBQVUsRUFBRSxvQkFBb0I7WUFDaEMsSUFBSSxFQUFFO2dCQUNKO29CQUNFLGNBQWMsRUFBRTt3QkFDZCxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUc7d0JBQ2xCLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSTt3QkFDbkIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHO3FCQUNuQjtvQkFDRCxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztpQkFDdEI7YUFDRjtZQUNELGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxFQUFFLEVBQUUsaUJBQWlCO29CQUNyQixVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUseUJBQXlCO2lCQUM5RDthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsa0JBQWtCO1FBQ2xCLE1BQU0sYUFBYSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lB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QUFDLENBQUM7UUFFSCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQzFCLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtZQUN0QyxXQUFXLEVBQUUsNkJBQTZCO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSxpQkFBaUI7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsV0FBVyxDQUFDLFVBQVU7WUFDN0IsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7UUFFSCxpRkFBaUY7UUFDakYsMERBQTBEO1FBQzFELElBQUkseUNBQWtCLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ2pELFNBQVMsRUFBRSxTQUFTO1NBQ3JCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdaRCxvQ0E2WkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBMYWJDb250ZW50SW1wb3J0ZXIgfSBmcm9tICcuL2xhYi1jb250ZW50LWltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIEVjZTQxODBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgdmlkZW8gc3RvcmFnZVxuICAgIGNvbnN0IHZpZGVvQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVmlkZW9CdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiAnZWNlNDE4MC1sYWItdmlkZW9zJyxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWaWRlb3MnLFxuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksIC8vIEtlZXAgdmlkZW9zIGZvciAxIHllYXJcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICBjb25zdCBzdHVkZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTdHVkZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZWNlNDE4MC1zdHVkZW50cycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ25hbWUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHNlY3Rpb25cbiAgICBzdHVkZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1NlY3Rpb25JbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3NlY3Rpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3VibWlzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU3VibWlzc2lvbnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2VjZTQxODAtc3VibWlzc2lvbnMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdWJtaXNzaW9uSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHN0dWRlbnRcbiAgICBzdWJtaXNzaW9uc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0dWRlbnRJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0dWRlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzdWJtaXR0ZWRBdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBxdWVyeWluZyBieSBsYWIgYW5kIHN0YXR1c1xuICAgIHN1Ym1pc3Npb25zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnTGFiU3RhdHVzSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdsYWJOdW1iZXInLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnc3RhdHVzJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhYlN0YXR1c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdMYWJTdGF0dXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2VjZTQxODAtbGFiLXN0YXR1cy12MicsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0dWRlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdsYWJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIExhYiBQcm9ncmVzcyB0YWJsZSBmb3IgdHJhY2tpbmcgZGV0YWlsZWQgcHJvZ3Jlc3Mgb24gbGFiIHBhcnRzXG4gICAgY29uc3QgbGFiUHJvZ3Jlc3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTGFiUHJvZ3Jlc3NUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2VjZTQxODAtbGFiLXByb2dyZXNzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3R1ZGVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3Byb2dyZXNzSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcbiAgICBcbiAgICAvLyBMYWIgR3JhZGVzIHRhYmxlIGZvciBzdG9yaW5nIGdyYWRlcyBmb3IgZWFjaCBsYWJcbiAgICBjb25zdCBsYWJHcmFkZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTGFiR3JhZGVzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdlY2U0MTgwLWxhYi1ncmFkZXMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdHVkZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnbGFiSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcbiAgICBcbiAgICAvLyBMYWJzIHRhYmxlIGZvciBzdG9yaW5nIGxhYiBkZXRhaWxzXG4gICAgY29uc3QgbGFic1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdMYWJzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdlY2U0MTgwLWxhYnMtdjEnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdsYWJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGxhYnMgYnkgb3JkZXJcbiAgICBsYWJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnT3JkZXJJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZGVyJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdlY2U0MTgwLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICByb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgICBzdHVkZW50SWQ6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIENsaWVudFxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2wsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIGN1c3RvbTogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLCAvLyBFbmFibGUgVVNFUl9QQVNTV09SRF9BVVRIIGZsb3dcbiAgICAgIH0sXG4gICAgICBzdXBwb3J0ZWRJZGVudGl0eVByb3ZpZGVyczogW1xuICAgICAgICBjb2duaXRvLlVzZXJQb29sQ2xpZW50SWRlbnRpdHlQcm92aWRlci5DT0dOSVRPLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBleGVjdXRpb24gcm9sZVxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBEeW5hbW9EQkFjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgYCR7c3VibWlzc2lvbnNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgICAgICAgICAgbGFiU3RhdHVzVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgbGFic1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGAke2xhYnNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgICAgICAgICAgc3R1ZGVudHNUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICBgJHtzdHVkZW50c1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgICAgICAgICBsYWJQcm9ncmVzc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGxhYkdyYWRlc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpHZXRTaWduZWRVcmwnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgJHt2aWRlb0J1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICBDb2duaXRvQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbdXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIEZ1bmN0aW9uc1xuICAgIGNvbnN0IGF1dGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1dGhGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2F1dGguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3Qgc3R1ZGVudHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0dWRlbnRzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzdHVkZW50cy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RVREVOVFNfVEFCTEU6IHN0dWRlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBMQUJfU1RBVFVTX1RBQkxFOiBsYWJTdGF0dXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIExBQl9QUk9HUkVTU19UQUJMRTogbGFiUHJvZ3Jlc3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIExBQl9HUkFERVNfVEFCTEU6IGxhYkdyYWRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgTEFCU19UQUJMRTogbGFic1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHN1Ym1pc3Npb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhYnNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xhYnNGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2xhYnMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIExBQl9TVEFUVVNfVEFCTEU6IGxhYlN0YXR1c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgTEFCU19UQUJMRTogbGFic1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHN1Ym1pc3Npb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBWSURFT19CVUNLRVQ6IHZpZGVvQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3VibWlzc2lvbnNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N1Ym1pc3Npb25zRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzdWJtaXNzaW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHN1Ym1pc3Npb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBWSURFT19CVUNLRVQ6IHZpZGVvQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdFY2U0MTgwQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdFQ0UgNDE4MCBDb3Vyc2UgQVBJJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciBFQ0UgNDE4MCBjb3Vyc2UgcGxhdGZvcm0nLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogW1xuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICdodHRwczovL2VjZTQxODAudmVyY2VsLmFwcCcsXG4gICAgICAgICAgJ2h0dHBzOi8vZW1iZWRkZWQtd2Vic2l0ZS0yLnZlcmNlbC5hcHAnLFxuICAgICAgICAgICdodHRwczovL2VtYmVkZGVkLXdlYnNpdGUtMi1naXQtbWFpbi52ZXJjZWwuYXBwJ1xuICAgICAgICBdLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgLi4uYXBpZ2F0ZXdheS5Db3JzLkRFRkFVTFRfSEVBREVSUyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdYLUFwaS1LZXknXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBDT1JTIGhlYWRlcnMgdG8gNFhYIGVycm9yIHJlc3BvbnNlc1xuICAgIG5ldyBhcGlnYXRld2F5LkdhdGV3YXlSZXNwb25zZSh0aGlzLCAnRGVmYXVsdDRYWCcsIHtcbiAgICAgIHJlc3RBcGk6IGFwaSxcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkRFRkFVTFRfNFhYLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIidodHRwOi8vbG9jYWxob3N0OjMwMDAsaHR0cHM6Ly9lY2U0MTgwLnZlcmNlbC5hcHAsaHR0cHM6Ly9lbWJlZGRlZC13ZWJzaXRlLTIudmVyY2VsLmFwcCxodHRwczovL2VtYmVkZGVkLXdlYnNpdGUtMi1naXQtbWFpbi52ZXJjZWwuYXBwJ1wiLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5J1wiLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ0dFVCxQT1NULE9QVElPTlMsUFVUJ1wiLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiBcIid0cnVlJ1wiXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIENPUlMgaGVhZGVycyB0byA1WFggZXJyb3IgcmVzcG9uc2VzXG4gICAgbmV3IGFwaWdhdGV3YXkuR2F0ZXdheVJlc3BvbnNlKHRoaXMsICdEZWZhdWx0NVhYJywge1xuICAgICAgcmVzdEFwaTogYXBpLFxuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuREVGQVVMVF81WFgsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCxodHRwczovL2VjZTQxODAudmVyY2VsLmFwcCxodHRwczovL2VtYmVkZGVkLXdlYnNpdGUtMi52ZXJjZWwuYXBwLGh0dHBzOi8vZW1iZWRkZWQtd2Vic2l0ZS0yLWdpdC1tYWluLnZlcmNlbC5hcHAnXCIsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1BbXotRGF0ZSxYLUFwaS1LZXknXCIsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULFBPU1QsT1BUSU9OUyxQVVQnXCIsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IFwiJ3RydWUnXCJcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplclxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQ29nbml0b0F1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIGNvbnN0IGF1dGhSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XG4gICAgXG4gICAgLy8gU3R1ZGVudHMgQVBJIGVuZHBvaW50c1xuICAgIGNvbnN0IHN0dWRlbnRzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc3R1ZGVudHMnKTtcbiAgICBzdHVkZW50c1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3R1ZGVudHNGdW5jdGlvbiksIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgfSk7XG4gICAgc3R1ZGVudHNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdHVkZW50c0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBzdHVkZW50UmVzb3VyY2UgPSBzdHVkZW50c1Jlc291cmNlLmFkZFJlc291cmNlKCd7bmFtZX0nKTtcbiAgICBzdHVkZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdHVkZW50c0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBzdHVkZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdHVkZW50c0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBcbiAgICAvLyBQcm9ncmVzcyBBUEkgZW5kcG9pbnRzXG4gICAgY29uc3QgcHJvZ3Jlc3NSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdwcm9ncmVzcycpO1xuICAgIHByb2dyZXNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdHVkZW50c0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBzdHVkZW50UHJvZ3Jlc3NSZXNvdXJjZSA9IHByb2dyZXNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tuYW1lfScpO1xuICAgIHN0dWRlbnRQcm9ncmVzc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3R1ZGVudHNGdW5jdGlvbiksIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgfSk7XG4gICAgc3R1ZGVudFByb2dyZXNzUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdHVkZW50c0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBhdXRoUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXV0aEZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBsYWJzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnbGFicycpO1xuICAgIGxhYnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxhYnNGdW5jdGlvbiksIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsYWJSZXNvdXJjZSA9IGxhYnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2xhYklkfScpO1xuICAgIGxhYlJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGFic0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcbiAgICBsYWJSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYWJzRnVuY3Rpb24pLCB7XG4gICAgICBhdXRob3JpemVyLFxuICAgIH0pO1xuICAgIC8vIEFkZCBQVVQgbWV0aG9kIGZvciB1cGRhdGluZyBsYWIgY29udGVudFxuICAgIGxhYlJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGFic0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIGNvbnN0IHVubG9ja1Jlc291cmNlID0gbGFiUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VubG9jaycpO1xuICAgIHVubG9ja1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxhYnNGdW5jdGlvbiksIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2NrUmVzb3VyY2UgPSBsYWJSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbG9jaycpO1xuICAgIGxvY2tSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYWJzRnVuY3Rpb24pLCB7XG4gICAgICBhdXRob3JpemVyLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3VibWl0UmVzb3VyY2UgPSBsYWJSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VibWl0Jyk7XG4gICAgc3VibWl0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGFic0Z1bmN0aW9uKSwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICB9KTtcblxuICAgIGNvbnN0IHN1Ym1pc3Npb25zUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc3VibWlzc2lvbnMnKTtcbiAgICBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNGdW5jdGlvbiksIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdWJtaXNzaW9uUmVzb3VyY2UgPSBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7c3VibWlzc2lvbklkfScpO1xuICAgIHN1Ym1pc3Npb25SZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zRnVuY3Rpb24pLCB7XG4gICAgICBhdXRob3JpemVyLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZpZGVvQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB2aWRlb0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBWaWRlbyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIHRoZSBsYWIgY29udGVudCBpbXBvcnRlciB0byBhdXRvbWF0aWNhbGx5IGxvYWQgbGFiIGNvbnRlbnQgZnJvbSBKU09OIGZpbGVzXG4gICAgLy8gVGhpcyB3aWxsIHByZXNlcnZlIHRoZSBcImxvY2tlZFwiIHN0YXR1cyBvZiBleGlzdGluZyBsYWJzXG4gICAgbmV3IExhYkNvbnRlbnRJbXBvcnRlcih0aGlzLCAnTGFiQ29udGVudEltcG9ydGVyJywge1xuICAgICAgbGFic1RhYmxlOiBsYWJzVGFibGVcbiAgICB9KTtcbiAgfVxufVxuIl19