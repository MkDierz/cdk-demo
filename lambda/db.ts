import { Pool, type PoolClient, type QueryResult } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface DbConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl?: boolean;
}

export type QueryFn = (sql: string, params?: unknown[]) => Promise<any[][]>;

let pool: Pool | null = null;

async function getSecretValue(secretArn: string): Promise<any> {
  const client = new SecretsManagerClient({});
  const resp = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret = resp.SecretString ?? Buffer.from(resp.SecretBinary ?? '').toString('utf8');
  try {
    return JSON.parse(secret);
  } catch {
    return { password: secret };
  }
}

export function dbConfigFromEnv(): DbConfig {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const secretArn = process.env.DB_SECRET_ARN;

  if (!host) {
    throw new Error('DB_HOST must be set');
  }
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  return {
    host,
    port,
    user: user ?? 'postgres',
    password: password ?? '',
    database: process.env.DB_NAME ?? 'postgres',
    ssl: process.env.DB_SSL === 'true',
  };
}

function getPool(config: DbConfig): Pool {
  if (pool === null) {
    pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function runQuery(config: DbConfig, sql: string, params: unknown[] = []): Promise<any[][]> {
  const result: QueryResult = await getPool(config).query(sql, params);
  return result.rows.map((row) => Object.values(row) as any[]);
}

export async function withTransaction<T>(
  config: DbConfig,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw e;
  } finally {
    client.release();
  }
}
