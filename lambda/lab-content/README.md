# Lab Content Directory

This directory contains the structured content for each lab in the course. When the CDK stack is deployed, these files need to be copied to the `lambda/lab-content` directory to be included in the Lambda function deployment package.

## Deployment Process

1. Create or update lab content JSON files in this directory
2. Copy the JSON files to the `lambda/lab-content` directory:
   ```
   cp *.json ../lambda/lab-content/
   ```
3. Deploy the CDK stack with `cdk deploy`

## File Structure

Each lab should have its own JSON file named after the lab ID (e.g., `lab1.json`, `lab2.json`, etc.). The file should contain a JSON object with the following structure:

```json
{
  "labId": "lab1",
  "title": "Lab Title",
  "description": "Brief description of the lab",
  "content": "Markdown content for backward compatibility",
  "structuredContent": {
    "sections": [
      {
        "id": "intro",
        "type": "introduction",
        "title": "Introduction",
        "order": 1,
        "content": [
          {
            "type": "text",
            "content": "Text content here"
          },
          {
            "type": "image",
            "url": "https://example.com/image.png",
            "caption": "Image caption"
          }
        ]
      },
      // More sections...
    ],
    "resources": [
      {
        "id": "resource1",
        "type": "document",
        "title": "Resource Title",
        "description": "Resource description",
        "url": "https://example.com/resource"
      }
      // More resources...
    ]
  },
  "order": 1,
  "locked": false,
  "createdAt": "2025-08-15T22:13:00.000Z",
  "updatedAt": "2025-08-15T22:13:00.000Z"
}
```

## Content Types

The `structuredContent` object supports the following section types:
- `introduction`: Introduction to the lab
- `objectives`: Learning objectives for the lab
- `requirements`: Hardware and software requirements
- `instructions`: Step-by-step instructions
- `submission`: Submission requirements
- `custom`: Any other custom section

Each section can contain multiple content blocks with the following types:
- `text`: Text content (supports Markdown)
- `image`: Image with URL and caption
- `code`: Code block with language and content
- `video`: Video with URL and caption
- `diagram`: Diagram with URL and caption
- `note`: Note or tip
- `warning`: Warning or caution

## Updating Labs

To update a lab:

1. Edit the corresponding JSON file in this directory
2. Deploy the CDK stack with `cdk deploy`

The Lambda function will automatically load the updated content and update the lab in the DynamoDB table.

## Adding New Labs

To add a new lab:

1. Create a new JSON file in this directory with the lab ID as the filename (e.g., `lab7.json`)
2. Fill in the required fields as shown in the structure above
3. Deploy the CDK stack with `cdk deploy`

The new lab will be automatically added to the DynamoDB table.