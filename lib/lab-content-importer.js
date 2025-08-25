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
exports.LabContentImporter = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const constructs_1 = require("constructs");
/**
 * Custom resource that imports lab content from JSON files into DynamoDB
 * This preserves the "locked" status of existing labs
 */
class LabContentImporter extends constructs_1.Construct {
    constructor(scope, id, props) {
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
exports.LabContentImporter = LabContentImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiLWNvbnRlbnQtaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYWItY29udGVudC1pbXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsaUVBQW1EO0FBR25ELDJDQUF1QztBQUV2Qzs7O0dBR0c7QUFDSCxNQUFhLGtCQUFtQixTQUFRLHNCQUFTO0lBQy9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FFekM7UUFDQyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLDBEQUEwRDtRQUMxRCxNQUFNLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3JFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLHFCQUFxQjtZQUM5QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ3JDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQVM7YUFDdEM7U0FDRixDQUFDLENBQUM7UUFFSCxnRUFBZ0U7UUFDaEUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVuRCx5REFBeUQ7UUFDekQsTUFBTSxRQUFRLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNqRSxjQUFjLEVBQUUsY0FBYztZQUM5QixZQUFZLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUNqRCxDQUFDLENBQUM7UUFFSCx3REFBd0Q7UUFDeEQsMkZBQTJGO1FBQzNGLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDakQsWUFBWSxFQUFFLFFBQVEsQ0FBQyxZQUFZO1lBQ25DLFVBQVUsRUFBRTtnQkFDVixTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQywyREFBMkQ7YUFDaEc7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFuQ0QsZ0RBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vKipcbiAqIEN1c3RvbSByZXNvdXJjZSB0aGF0IGltcG9ydHMgbGFiIGNvbnRlbnQgZnJvbSBKU09OIGZpbGVzIGludG8gRHluYW1vREJcbiAqIFRoaXMgcHJlc2VydmVzIHRoZSBcImxvY2tlZFwiIHN0YXR1cyBvZiBleGlzdGluZyBsYWJzXG4gKi9cbmV4cG9ydCBjbGFzcyBMYWJDb250ZW50SW1wb3J0ZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczoge1xuICAgIGxhYnNUYWJsZTogZHluYW1vZGIuVGFibGVcbiAgfSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIExhbWJkYSBmdW5jdGlvbiB0aGF0IHdpbGwgaW1wb3J0IGxhYiBjb250ZW50XG4gICAgY29uc3QgaW1wb3J0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJbXBvcnRMYWJzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbXBvcnQtbGFicy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBMQUJTX1RBQkxFOiBwcm9wcy5sYWJzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCB0aGUgTGFtYmRhIGZ1bmN0aW9uIHJlYWQvd3JpdGUgYWNjZXNzIHRvIHRoZSBsYWJzIHRhYmxlXG4gICAgcHJvcHMubGFic1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShpbXBvcnRGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgYSBwcm92aWRlciB0aGF0IHdpbGwgaW52b2tlIG91ciBMYW1iZGEgZnVuY3Rpb25cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBjci5Qcm92aWRlcih0aGlzLCAnTGFiQ29udGVudEltcG9ydFByb3ZpZGVyJywge1xuICAgICAgb25FdmVudEhhbmRsZXI6IGltcG9ydEZ1bmN0aW9uLFxuICAgICAgbG9nUmV0ZW50aW9uOiBjZGsuYXdzX2xvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYSBjdXN0b20gcmVzb3VyY2UgdGhhdCB3aWxsIHRyaWdnZXIgdGhlIGltcG9ydFxuICAgIC8vIFRoZSByZXNvdXJjZSBpcyB0cmlnZ2VyZWQgb24gZXZlcnkgZGVwbG95bWVudCBiZWNhdXNlIHdlIHVzZSBhIHRpbWVzdGFtcCBhcyB0aGUgcHJvcGVydHlcbiAgICBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdJbXBvcnRMYWJzUmVzb3VyY2UnLCB7XG4gICAgICBzZXJ2aWNlVG9rZW46IHByb3ZpZGVyLnNlcnZpY2VUb2tlbixcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgLy8gVGhpcyBlbnN1cmVzIHRoZSByZXNvdXJjZSBpcyB1cGRhdGVkIG9uIGV2ZXJ5IGRlcGxveW1lbnRcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSJdfQ==