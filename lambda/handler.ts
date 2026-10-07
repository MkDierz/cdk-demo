import type { AppSyncResolverEvent } from 'aws-lambda';
import { dbConfigFromEnv, runOperation, type QueryFn, type DynamoDBOp } from './db';
import { randomUUID } from 'crypto';

export interface Todo {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: string;
}

function toString(val: unknown): string {
  return val === null || val === undefined ? '' : String(val);
}

function toBoolean(val: unknown): boolean {
  return Boolean(val);
}

export function rowToTodo(row: any): Todo {
  return {
    id: toString(row.id),
    title: toString(row.title),
    done: toBoolean(row.done),
    createdAt: toString(row.createdAt || row.created_at),
  };
}

export async function handleEvent(
  event: AppSyncResolverEvent<Record<string, unknown>>,
  query: QueryFn,
): Promise<unknown> {
  const args = event.arguments ?? {};

  switch (event.info.fieldName) {
    case 'listTodos': {
      const rows = await query('listTodos');
      return rows.map(rowToTodo);
    }
    case 'getTodo': {
      const rows = await query('getTodo', { id: String(args.id) });
      return rows.length > 0 ? rowToTodo(rows[0]) : null;
    }
    case 'addTodo': {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const rows = await query('addTodo', {
        id,
        title: String(args.title),
        createdAt,
      });
      if (rows.length === 0) throw new Error('INSERT returned no row');
      return rowToTodo(rows[0]);
    }
    case 'toggleTodo': {
      const existing = await query('getTodo', { id: String(args.id) });
      if (existing.length === 0) throw new Error(`Todo not found: ${String(args.id)}`);
      const newDone = !toBoolean(existing[0].done);
      const rows = await query('toggleTodo', { id: String(args.id), done: newDone });
      if (rows.length === 0) throw new Error(`Todo not found: ${String(args.id)}`);
      return rowToTodo(rows[0]);
    }
    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<unknown> => {
  const config = dbConfigFromEnv();
  return handleEvent(event, (op: DynamoDBOp, params?: any) => runOperation(config, op, params));
};
