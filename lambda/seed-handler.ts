import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TABLE_NAME;

export interface SeedEvent {
  readonly RequestType: 'Create' | 'Update' | 'Delete';
  readonly ResourceProperties: {
    readonly schemaVersion: string;
  };
}

export const handler = async (_event: SeedEvent): Promise<Record<string, unknown>> => {
  if (!tableName) {
    throw new Error('TABLE_NAME must be set');
  }
  const result = await docClient.send(new ScanCommand({ TableName: tableName, Limit: 1 }));
  const hasItems = (result.Count ?? 0) > 0 || (result.Items && result.Items.length > 0);
  if (!hasItems) {
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: 'seed-1',
          title: 'Learn CDK',
          done: true,
          createdAt: now,
        },
      }),
    );
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: 'seed-2',
          title: 'Build a GraphQL API',
          done: false,
          createdAt: new Date(Date.now() - 1000).toISOString(),
        },
      }),
    );
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: 'seed-3',
          title: 'Connect to DynamoDB',
          done: false,
          createdAt: new Date(Date.now() - 2000).toISOString(),
        },
      }),
    );
  }
  return { PhysicalResourceId: 'todo-seed' };
};
