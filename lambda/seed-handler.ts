import { dbConfigFromEnv, runQuery } from './db';

export interface SeedEvent {
  readonly RequestType: 'Create' | 'Update' | 'Delete';
  readonly ResourceProperties: {
    readonly schemaVersion: string;
  };
}

const DDL = `
  CREATE TABLE IF NOT EXISTS todos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  INSERT INTO todos (title, done)
  SELECT 'Learn CDK', true
  WHERE NOT EXISTS (SELECT 1 FROM todos WHERE title = 'Learn CDK');

  INSERT INTO todos (title, done)
  SELECT 'Build a GraphQL API', false
  WHERE NOT EXISTS (SELECT 1 FROM todos WHERE title = 'Build a GraphQL API');

  INSERT INTO todos (title, done)
  SELECT 'Connect to Aurora', false
  WHERE NOT EXISTS (SELECT 1 FROM todos WHERE title = 'Connect to Aurora');
`;

export const handler = async (_event: SeedEvent): Promise<Record<string, unknown>> => {
  const config = dbConfigFromEnv();
  await runQuery(config, DDL);
  return { PhysicalResourceId: 'todo-seed' };
};
