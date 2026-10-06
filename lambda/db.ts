import {
  ExecuteStatementCommand,
  RDSDataClient,
  type Field,
  type SqlParameter,
} from '@aws-sdk/client-rds-data';

export interface DbConfig {
  readonly resourceArn: string;
  readonly secretArn: string;
  readonly database: string;
}

export type QueryFn = (sql: string, params?: SqlParameter[]) => Promise<Field[][]>;

const client = new RDSDataClient({});

export function dbConfigFromEnv(): DbConfig {
  const resourceArn = process.env.DB_RESOURCE_ARN;
  const secretArn = process.env.DB_SECRET_ARN;
  if (!resourceArn || !secretArn) {
    throw new Error('DB_RESOURCE_ARN and DB_SECRET_ARN must be set');
  }
  return {
    resourceArn,
    secretArn,
    database: process.env.DB_NAME ?? 'postgres',
  };
}

export async function runQuery(config: DbConfig, sql: string, params: SqlParameter[] = []): Promise<Field[][]> {
  const result = await client.send(
    new ExecuteStatementCommand({
      resourceArn: config.resourceArn,
      secretArn: config.secretArn,
      database: config.database,
      sql,
      parameters: params,
    }),
  );
  return result.records ?? [];
}
