import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { dbConfigFromEnv, runQuery } from './db';

// Idempotent DDL — safe to run on every deploy.
const CREATE_TODOS_TABLE = `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

// ON CONFLICT DO NOTHING keeps re-runs from duplicating rows.
const SEED_TODOS = `
INSERT INTO todos (title) VALUES
  ('Read the CDK docs'),
  ('Ship the GraphQL demo')
ON CONFLICT DO NOTHING`;

export async function handleSeedEvent(event: CloudFormationCustomResourceEvent): Promise<unknown> {
  if (event.RequestType === 'Delete') {
    // Leave the data alone; the cluster itself is removed by CloudFormation.
    return { PhysicalResourceId: event.PhysicalResourceId };
  }

  const config = dbConfigFromEnv();
  await runQuery(config, CREATE_TODOS_TABLE);
  await runQuery(config, SEED_TODOS);

  return { PhysicalResourceId: 'TodoSchemaSeed' };
}

export const handler = handleSeedEvent;
