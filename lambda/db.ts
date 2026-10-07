import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export interface DbConfig {
  readonly tableName: string;
  readonly region?: string;
}

export type QueryFn = (operation: DynamoDBOp, params?: any) => Promise<any[]>;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export type DynamoDBOp = 'listTodos' | 'getTodo' | 'addTodo' | 'toggleTodo';

export function dbConfigFromEnv(): DbConfig {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME must be set');
  }
  return {
    tableName,
    region: process.env.AWS_REGION,
  };
}

export async function runOperation(config: DbConfig, operation: DynamoDBOp, params: any = {}): Promise<any[]> {
  switch (operation) {
    case 'listTodos': {
      const result = await docClient.send(
        new ScanCommand({
          TableName: config.tableName,
        }),
      );
      const items = result.Items ?? [];
      return items.sort((a, b) => {
        const aTime = a.createdAt || a.created_at || '';
        const bTime = b.createdAt || b.created_at || '';
        return bTime.localeCompare(aTime);
      });
    }
    case 'getTodo': {
      const result = await docClient.send(
        new GetCommand({
          TableName: config.tableName,
          Key: { id: params.id },
        }),
      );
      return result.Item ? [result.Item] : [];
    }
    case 'addTodo': {
      const item = {
        id: params.id,
        title: params.title,
        done: false,
        createdAt: params.createdAt,
      };
      await docClient.send(
        new PutCommand({
          TableName: config.tableName,
          Item: item,
        }),
      );
      return [item];
    }
    case 'toggleTodo': {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: config.tableName,
          Key: { id: params.id },
          UpdateExpression: 'SET done = :done',
          ExpressionAttributeValues: { ':done': params.done },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes ? [result.Attributes] : [];
    }
    default:
      return [];
  }
}
