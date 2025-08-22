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
        allowOrigins: ['http://localhost:3000', 'https://ece4180.vercel.app'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
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
    new LabContentImporter(this, 'LabContentImporter', {
      labsTable: labsTable
    });
  }
}
