import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class LabTables extends Construct {
  public readonly labsTable: dynamodb.Table;
  public readonly labStatusTable: dynamodb.Table;
  public readonly submissionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
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

// Lab Schema
export interface Lab {
  labId: string;           // Partition key
  title: string;           // Lab title
  description: string;     // Short description
  content?: string;        // Legacy content (markdown)
  structuredContent?: {    // New structured content format
    sections: LabSection[];
    resources?: LabResource[];
  };
  order: number;           // For ordering labs in the UI
  locked: boolean;         // Whether the lab is locked for students
  createdAt: string;       // ISO date string
  updatedAt: string;       // ISO date string
}

// Lab Section Schema
export interface LabSection {
  id: string;              // Section identifier
  type: string;            // Section type (introduction, objectives, etc.)
  title: string;           // Section title
  order: number;           // For ordering sections
  content: LabContentBlock[] | string; // Content blocks or legacy string
}

// Lab Content Block Schema
export interface LabContentBlock {
  type: string;            // Block type (text, image, code, etc.)
  content: string;         // Block content
  caption?: string;        // Optional caption
  language?: string;       // For code blocks
  url?: string;            // For images, videos, etc.
}

// Lab Resource Schema
export interface LabResource {
  id: string;              // Resource identifier
  type: string;            // Resource type (document, image, video, link)
  title: string;           // Resource title
  description?: string;    // Optional description
  url: string;             // Resource URL
}

// Lab Status Schema
export interface LabStatus {
  studentId: string;       // Partition key
  labId: string;           // Sort key
  status: string;          // Status (locked, unlocked)
  unlockedAt?: string;     // When the lab was unlocked
  completed: boolean;      // Whether the lab is completed
  submissionStatus?: string; // Status of the submission (pending, approved, rejected)
  submissionId?: string;   // Reference to the submission
  updatedAt: string;       // ISO date string
}

// Submission Schema
export interface Submission {
  submissionId: string;    // Partition key
  labId: string;           // Lab ID
  studentId: string;       // Student ID
  userId: string;          // Cognito user ID
  username: string;        // Username
  fileKey: string;         // S3 file key
  videoUrl?: string;       // Video URL
  notes: string;           // Submission notes
  status: string;          // Status (pending, approved, rejected)
  feedback?: string;       // Feedback from staff
  submittedAt: string;     // ISO date string
  updatedAt: string;       // ISO date string
}