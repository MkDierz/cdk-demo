import type { AppSyncResolverEvent } from 'aws-lambda';
import type { Field, SqlParameter } from '@aws-sdk/client-rds-data';
import { dbConfigFromEnv, runQuery, type QueryFn } from './db';

export interface Todo {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: string;
}

// Must match the column order expected by rowToTodo.
const COLUMNS = 'id, title, done, created_at';

function str(field: Field | undefined): string {
  return field?.stringValue ?? '';
}

export function rowToTodo(row: Field[]): Todo {
  return {
    id: str(row[0]),
    title: str(row[1]),
    done: row[2]?.booleanValue ?? false,
    createdAt: str(row[3]),
  };
}

/**
 * Pure dispatch logic: AppSync sends the field name, we pick the SQL.
 * The `query` dependency is injected so tests can run without AWS.
 */
export async function handleEvent(
  event: AppSyncResolverEvent<Record<string, unknown>>,
  query: QueryFn,
): Promise<unknown> {
  const args = event.arguments ?? {};

  switch (event.info.fieldName) {
    case 'listTodos': {
      const rows = await query(`SELECT ${COLUMNS} FROM todos ORDER BY created_at DESC`);
      return rows.map(rowToTodo);
    }
    case 'getTodo': {
      const rows = await query(`SELECT ${COLUMNS} FROM todos WHERE id = :id`, [
        { name: 'id', value: { stringValue: String(args.id) } },
      ]);
      return rows.length > 0 ? rowToTodo(rows[0]) : null;
    }
    case 'addTodo': {
      // RETURNING yields the inserted row without a second round trip.
      const rows = await query(`INSERT INTO todos (title) VALUES (:title) RETURNING ${COLUMNS}`, [
        { name: 'title', value: { stringValue: String(args.title) } },
      ]);
      if (rows.length === 0) throw new Error('INSERT returned no row');
      return rowToTodo(rows[0]);
    }
    case 'toggleTodo': {
      const rows = await query(`UPDATE todos SET done = NOT done WHERE id = :id RETURNING ${COLUMNS}`, [
        { name: 'id', value: { stringValue: String(args.id) } },
      ]);
      if (rows.length === 0) throw new Error(`Todo not found: ${String(args.id)}`);
      return rowToTodo(rows[0]);
    }
    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<unknown> => {
  const config = dbConfigFromEnv();
  return handleEvent(event, (sql, params) => runQuery(config, sql, params));
};
