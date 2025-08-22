import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Custom resource that imports lab content from JSON files into DynamoDB
 * This preserves the "locked" status of existing labs
 */
export class LabContentImporter extends Construct {
  constructor(scope: Construct, id: string, props: {
    labsTable: dynamodb.Table
  }) {
    super(scope, id);

    // Create the Lambda function that will import lab content
    const importFunction = new lambda.Function(this, 'ImportLabsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'import-labs.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        LABS_TABLE: props.labsTable.tableName
      }
    });

    // Grant the Lambda function read/write access to the labs table
    props.labsTable.grantReadWriteData(importFunction);

    // Create a provider that will invoke our Lambda function
    const provider = new cr.Provider(this, 'LabContentImportProvider', {
      onEventHandler: importFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY
    });

    // Create a custom resource that will trigger the import
    // The resource is triggered on every deployment because we use a timestamp as the property
    new cdk.CustomResource(this, 'ImportLabsResource', {
      serviceToken: provider.serviceToken,
      properties: {
        timestamp: new Date().toISOString() // This ensures the resource is updated on every deployment
      }
    });
  }
}