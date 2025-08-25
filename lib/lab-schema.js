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
exports.LabTables = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const constructs_1 = require("constructs");
class LabTables extends constructs_1.Construct {
    labsTable;
    labStatusTable;
    submissionsTable;
    constructor(scope, id) {
        super(scope, id);
        // Labs Table - Stores lab definitions and metadata
        this.labsTable = new dynamodb.Table(this, 'Labs', {
            partitionKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Add GSI for ordering labs
        this.labsTable.addGlobalSecondaryIndex({
            indexName: 'OrderIndex',
            partitionKey: { name: 'order', type: dynamodb.AttributeType.NUMBER },
        });
        // Lab Status Table - Stores student-specific lab status
        this.labStatusTable = new dynamodb.Table(this, 'LabStatus', {
            partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Submissions Table - Stores lab submissions
        this.submissionsTable = new dynamodb.Table(this, 'Submissions', {
            partitionKey: { name: 'submissionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Add GSI for looking up submissions by student
        this.submissionsTable.addGlobalSecondaryIndex({
            indexName: 'StudentIndex',
            partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
        });
        // Add GSI for looking up submissions by lab
        this.submissionsTable.addGlobalSecondaryIndex({
            indexName: 'LabIndex',
            partitionKey: { name: 'labId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
        });
    }
}
exports.LabTables = LabTables;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiLXNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxhYi1zY2hlbWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELDJDQUF1QztBQUV2QyxNQUFhLFNBQVUsU0FBUSxzQkFBUztJQUN0QixTQUFTLENBQWlCO0lBQzFCLGNBQWMsQ0FBaUI7SUFDL0IsZ0JBQWdCLENBQWlCO0lBRWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVO1FBQ3RDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUU7WUFDaEQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDcEUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1NBQ3hDLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLHVCQUF1QixDQUFDO1lBQ3JDLFNBQVMsRUFBRSxZQUFZO1lBQ3ZCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ3JFLENBQUMsQ0FBQztRQUVILHdEQUF3RDtRQUN4RCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzFELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3hFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQy9ELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtTQUN4QyxDQUFDLENBQUM7UUFFSCw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQzlELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzNFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtTQUN4QyxDQUFDLENBQUM7UUFFSCxnREFBZ0Q7UUFDaEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDO1lBQzVDLFNBQVMsRUFBRSxjQUFjO1lBQ3pCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3hFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ3RFLENBQUMsQ0FBQztRQUVILDRDQUE0QztRQUM1QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUM7WUFDNUMsU0FBUyxFQUFFLFVBQVU7WUFDckIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDcEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7U0FDdEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbERELDhCQWtEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBMYWJUYWJsZXMgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgbGFic1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGxhYlN0YXR1c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHN1Ym1pc3Npb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gTGFicyBUYWJsZSAtIFN0b3JlcyBsYWIgZGVmaW5pdGlvbnMgYW5kIG1ldGFkYXRhXG4gICAgdGhpcy5sYWJzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0xhYnMnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2xhYklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBvcmRlcmluZyBsYWJzXG4gICAgdGhpcy5sYWJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnT3JkZXJJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZGVyJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIExhYiBTdGF0dXMgVGFibGUgLSBTdG9yZXMgc3R1ZGVudC1zcGVjaWZpYyBsYWIgc3RhdHVzXG4gICAgdGhpcy5sYWJTdGF0dXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTGFiU3RhdHVzJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdHVkZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnbGFiSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIFN1Ym1pc3Npb25zIFRhYmxlIC0gU3RvcmVzIGxhYiBzdWJtaXNzaW9uc1xuICAgIHRoaXMuc3VibWlzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU3VibWlzc2lvbnMnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N1Ym1pc3Npb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgbG9va2luZyB1cCBzdWJtaXNzaW9ucyBieSBzdHVkZW50XG4gICAgdGhpcy5zdWJtaXNzaW9uc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0dWRlbnRJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0dWRlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzdWJtaXR0ZWRBdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBsb29raW5nIHVwIHN1Ym1pc3Npb25zIGJ5IGxhYlxuICAgIHRoaXMuc3VibWlzc2lvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdMYWJJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2xhYklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3N1Ym1pdHRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBMYWIgU2NoZW1hXG5leHBvcnQgaW50ZXJmYWNlIExhYiB7XG4gIGxhYklkOiBzdHJpbmc7ICAgICAgICAgICAvLyBQYXJ0aXRpb24ga2V5XG4gIHRpdGxlOiBzdHJpbmc7ICAgICAgICAgICAvLyBMYWIgdGl0bGVcbiAgZGVzY3JpcHRpb246IHN0cmluZzsgICAgIC8vIFNob3J0IGRlc2NyaXB0aW9uXG4gIGNvbnRlbnQ/OiBzdHJpbmc7ICAgICAgICAvLyBMZWdhY3kgY29udGVudCAobWFya2Rvd24pXG4gIHN0cnVjdHVyZWRDb250ZW50PzogeyAgICAvLyBOZXcgc3RydWN0dXJlZCBjb250ZW50IGZvcm1hdFxuICAgIHNlY3Rpb25zOiBMYWJTZWN0aW9uW107XG4gICAgcmVzb3VyY2VzPzogTGFiUmVzb3VyY2VbXTtcbiAgfTtcbiAgb3JkZXI6IG51bWJlcjsgICAgICAgICAgIC8vIEZvciBvcmRlcmluZyBsYWJzIGluIHRoZSBVSVxuICBsb2NrZWQ6IGJvb2xlYW47ICAgICAgICAgLy8gV2hldGhlciB0aGUgbGFiIGlzIGxvY2tlZCBmb3Igc3R1ZGVudHNcbiAgY3JlYXRlZEF0OiBzdHJpbmc7ICAgICAgIC8vIElTTyBkYXRlIHN0cmluZ1xuICB1cGRhdGVkQXQ6IHN0cmluZzsgICAgICAgLy8gSVNPIGRhdGUgc3RyaW5nXG59XG5cbi8vIExhYiBTZWN0aW9uIFNjaGVtYVxuZXhwb3J0IGludGVyZmFjZSBMYWJTZWN0aW9uIHtcbiAgaWQ6IHN0cmluZzsgICAgICAgICAgICAgIC8vIFNlY3Rpb24gaWRlbnRpZmllclxuICB0eXBlOiBzdHJpbmc7ICAgICAgICAgICAgLy8gU2VjdGlvbiB0eXBlIChpbnRyb2R1Y3Rpb24sIG9iamVjdGl2ZXMsIGV0Yy4pXG4gIHRpdGxlOiBzdHJpbmc7ICAgICAgICAgICAvLyBTZWN0aW9uIHRpdGxlXG4gIG9yZGVyOiBudW1iZXI7ICAgICAgICAgICAvLyBGb3Igb3JkZXJpbmcgc2VjdGlvbnNcbiAgY29udGVudDogTGFiQ29udGVudEJsb2NrW10gfCBzdHJpbmc7IC8vIENvbnRlbnQgYmxvY2tzIG9yIGxlZ2FjeSBzdHJpbmdcbn1cblxuLy8gTGFiIENvbnRlbnQgQmxvY2sgU2NoZW1hXG5leHBvcnQgaW50ZXJmYWNlIExhYkNvbnRlbnRCbG9jayB7XG4gIHR5cGU6IHN0cmluZzsgICAgICAgICAgICAvLyBCbG9jayB0eXBlICh0ZXh0LCBpbWFnZSwgY29kZSwgZXRjLilcbiAgY29udGVudDogc3RyaW5nOyAgICAgICAgIC8vIEJsb2NrIGNvbnRlbnRcbiAgY2FwdGlvbj86IHN0cmluZzsgICAgICAgIC8vIE9wdGlvbmFsIGNhcHRpb25cbiAgbGFuZ3VhZ2U/OiBzdHJpbmc7ICAgICAgIC8vIEZvciBjb2RlIGJsb2Nrc1xuICB1cmw/OiBzdHJpbmc7ICAgICAgICAgICAgLy8gRm9yIGltYWdlcywgdmlkZW9zLCBldGMuXG59XG5cbi8vIExhYiBSZXNvdXJjZSBTY2hlbWFcbmV4cG9ydCBpbnRlcmZhY2UgTGFiUmVzb3VyY2Uge1xuICBpZDogc3RyaW5nOyAgICAgICAgICAgICAgLy8gUmVzb3VyY2UgaWRlbnRpZmllclxuICB0eXBlOiBzdHJpbmc7ICAgICAgICAgICAgLy8gUmVzb3VyY2UgdHlwZSAoZG9jdW1lbnQsIGltYWdlLCB2aWRlbywgbGluaylcbiAgdGl0bGU6IHN0cmluZzsgICAgICAgICAgIC8vIFJlc291cmNlIHRpdGxlXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nOyAgICAvLyBPcHRpb25hbCBkZXNjcmlwdGlvblxuICB1cmw6IHN0cmluZzsgICAgICAgICAgICAgLy8gUmVzb3VyY2UgVVJMXG59XG5cbi8vIExhYiBTdGF0dXMgU2NoZW1hXG5leHBvcnQgaW50ZXJmYWNlIExhYlN0YXR1cyB7XG4gIHN0dWRlbnRJZDogc3RyaW5nOyAgICAgICAvLyBQYXJ0aXRpb24ga2V5XG4gIGxhYklkOiBzdHJpbmc7ICAgICAgICAgICAvLyBTb3J0IGtleVxuICBzdGF0dXM6IHN0cmluZzsgICAgICAgICAgLy8gU3RhdHVzIChsb2NrZWQsIHVubG9ja2VkKVxuICB1bmxvY2tlZEF0Pzogc3RyaW5nOyAgICAgLy8gV2hlbiB0aGUgbGFiIHdhcyB1bmxvY2tlZFxuICBjb21wbGV0ZWQ6IGJvb2xlYW47ICAgICAgLy8gV2hldGhlciB0aGUgbGFiIGlzIGNvbXBsZXRlZFxuICBzdWJtaXNzaW9uU3RhdHVzPzogc3RyaW5nOyAvLyBTdGF0dXMgb2YgdGhlIHN1Ym1pc3Npb24gKHBlbmRpbmcsIGFwcHJvdmVkLCByZWplY3RlZClcbiAgc3VibWlzc2lvbklkPzogc3RyaW5nOyAgIC8vIFJlZmVyZW5jZSB0byB0aGUgc3VibWlzc2lvblxuICB1cGRhdGVkQXQ6IHN0cmluZzsgICAgICAgLy8gSVNPIGRhdGUgc3RyaW5nXG59XG5cbi8vIFN1Ym1pc3Npb24gU2NoZW1hXG5leHBvcnQgaW50ZXJmYWNlIFN1Ym1pc3Npb24ge1xuICBzdWJtaXNzaW9uSWQ6IHN0cmluZzsgICAgLy8gUGFydGl0aW9uIGtleVxuICBsYWJJZDogc3RyaW5nOyAgICAgICAgICAgLy8gTGFiIElEXG4gIHN0dWRlbnRJZDogc3RyaW5nOyAgICAgICAvLyBTdHVkZW50IElEXG4gIHVzZXJJZDogc3RyaW5nOyAgICAgICAgICAvLyBDb2duaXRvIHVzZXIgSURcbiAgdXNlcm5hbWU6IHN0cmluZzsgICAgICAgIC8vIFVzZXJuYW1lXG4gIGZpbGVLZXk6IHN0cmluZzsgICAgICAgICAvLyBTMyBmaWxlIGtleVxuICB2aWRlb1VybD86IHN0cmluZzsgICAgICAgLy8gVmlkZW8gVVJMXG4gIG5vdGVzOiBzdHJpbmc7ICAgICAgICAgICAvLyBTdWJtaXNzaW9uIG5vdGVzXG4gIHN0YXR1czogc3RyaW5nOyAgICAgICAgICAvLyBTdGF0dXMgKHBlbmRpbmcsIGFwcHJvdmVkLCByZWplY3RlZClcbiAgZmVlZGJhY2s/OiBzdHJpbmc7ICAgICAgIC8vIEZlZWRiYWNrIGZyb20gc3RhZmZcbiAgc3VibWl0dGVkQXQ6IHN0cmluZzsgICAgIC8vIElTTyBkYXRlIHN0cmluZ1xuICB1cGRhdGVkQXQ6IHN0cmluZzsgICAgICAgLy8gSVNPIGRhdGUgc3RyaW5nXG59Il19