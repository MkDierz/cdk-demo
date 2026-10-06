import type { AppSyncResolverEvent } from 'aws-lambda';
import type { Field } from '@aws-sdk/client-rds-data';
import type { QueryFn } from '../lambda/db';
import { handleEvent, rowToTodo } from '../lambda/handler';

function appSyncEvent(fieldName: string, args: Record<string, unknown> = {}) {
  return { arguments: args, info: { fieldName } } as unknown as AppSyncResolverEvent<
    Record<string, unknown>
  >;
}

function makeQuery(rows: Field[][]) {
  return jest.fn().mockResolvedValue(rows) as unknown as jest.MockedFunction<QueryFn>;
}

const todoRow: Field[] = [
  { stringValue: 'abc-123' },
  { stringValue: 'Write tests' },
  { booleanValue: false },
  { stringValue: '2026-10-06T12:00:00.000Z' },
];

describe('rowToTodo', () => {
  test('maps Data API fields to the GraphQL shape', () => {
    expect(rowToTodo(todoRow)).toEqual({
      id: 'abc-123',
      title: 'Write tests',
      done: false,
      createdAt: '2026-10-06T12:00:00.000Z',
    });
  });
});

describe('handleEvent', () => {
  test('listTodos selects all columns and maps every row', async () => {
    const query = makeQuery([todoRow, todoRow]);

    const result = await handleEvent(appSyncEvent('listTodos'), query);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, title, done, created_at FROM todos'),
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { id: 'abc-123', title: 'Write tests', done: false, createdAt: '2026-10-06T12:00:00.000Z' },
      { id: 'abc-123', title: 'Write tests', done: false, createdAt: '2026-10-06T12:00:00.000Z' },
    ]);
  });

  test('getTodo binds the id as a parameter and returns null when missing', async () => {
    const query = makeQuery([]);

    const result = await handleEvent(appSyncEvent('getTodo', { id: 'nope' }), query);

    expect(query.mock.calls[0][0]).toContain('WHERE id = :id');
    expect(query.mock.calls[0][1]).toEqual([{ name: 'id', value: { stringValue: 'nope' } }]);
    expect(result).toBeNull();
  });

  test('addTodo inserts with RETURNING and binds the title', async () => {
    const query = makeQuery([todoRow]);

    await handleEvent(appSyncEvent('addTodo', { title: 'Ship it' }), query);

    expect(query.mock.calls[0][0]).toContain('INSERT INTO todos (title) VALUES (:title) RETURNING');
    expect(query.mock.calls[0][1]).toEqual([{ name: 'title', value: { stringValue: 'Ship it' } }]);
  });

  test('user input never lands in the SQL string (parameterized queries)', async () => {
    const evil = "Robert'); DROP TABLE todos;--";
    const query = makeQuery([todoRow]);

    await handleEvent(appSyncEvent('addTodo', { title: evil }), query);

    expect(query.mock.calls[0][0]).not.toContain(evil);
    expect(query.mock.calls[0][1]).toEqual([{ name: 'title', value: { stringValue: evil } }]);
  });

  test('toggleTodo flips done via UPDATE ... RETURNING', async () => {
    const query = makeQuery([todoRow]);

    await handleEvent(appSyncEvent('toggleTodo', { id: 'abc-123' }), query);

    expect(query.mock.calls[0][0]).toContain('UPDATE todos SET done = NOT done WHERE id = :id');
    expect(query.mock.calls[0][1]).toEqual([{ name: 'id', value: { stringValue: 'abc-123' } }]);
  });

  test('toggleTodo throws when the id does not exist', async () => {
    const query = makeQuery([]);

    await expect(handleEvent(appSyncEvent('toggleTodo', { id: 'ghost' }), query)).rejects.toThrow(
      'Todo not found: ghost',
    );
  });

  test('unknown field throws instead of silently succeeding', async () => {
    const query = makeQuery([]);

    await expect(handleEvent(appSyncEvent('dropTable'), query)).rejects.toThrow(
      'Unknown field: dropTable',
    );
  });
});
