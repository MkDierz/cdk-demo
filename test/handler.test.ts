import type { AppSyncResolverEvent } from 'aws-lambda';
import type { QueryFn } from '../lambda/db';
import { handleEvent, rowToTodo } from '../lambda/handler';

function appSyncEvent(fieldName: string, args: Record<string, unknown> = {}) {
  return { arguments: args, info: { fieldName } } as unknown as AppSyncResolverEvent<
    Record<string, unknown>
  >;
}

function makeQuery(rows: any[]) {
  return jest.fn().mockResolvedValue(rows) as unknown as jest.MockedFunction<QueryFn>;
}

const todoRow = { id: 'abc-123', title: 'Write tests', done: false, createdAt: '2026-10-06T12:00:00.000Z' };

describe('rowToTodo', () => {
  test('maps fields to the GraphQL shape', () => {
    expect(rowToTodo(todoRow)).toEqual({
      id: 'abc-123',
      title: 'Write tests',
      done: false,
      createdAt: '2026-10-06T12:00:00.000Z',
    });
  });
});

describe('handleEvent', () => {
  test('listTodos calls listTodos operation', async () => {
    const query = makeQuery([todoRow, todoRow]);

    const result = await handleEvent(appSyncEvent('listTodos'), query);

    expect(query).toHaveBeenCalledWith('listTodos');
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { id: 'abc-123', title: 'Write tests', done: false, createdAt: '2026-10-06T12:00:00.000Z' },
      { id: 'abc-123', title: 'Write tests', done: false, createdAt: '2026-10-06T12:00:00.000Z' },
    ]);
  });

  test('getTodo calls getTodo with id', async () => {
    const query = makeQuery([]);

    const result = await handleEvent(appSyncEvent('getTodo', { id: 'nope' }), query);

    expect(query.mock.calls[0][0]).toBe('getTodo');
    expect(query.mock.calls[0][1]).toEqual({ id: 'nope' });
    expect(result).toBeNull();
  });

  test('addTodo calls addTodo with title and generated fields', async () => {
    const query = makeQuery([todoRow]);

    await handleEvent(appSyncEvent('addTodo', { title: 'Ship it' }), query);

    expect(query.mock.calls[0][0]).toBe('addTodo');
    expect(query.mock.calls[0][1].title).toBe('Ship it');
    expect(query.mock.calls[0][1].id).toBeDefined();
    expect(query.mock.calls[0][1].createdAt).toBeDefined();
  });

  test('user input is passed as parameter', async () => {
    const evil = "Robert'); DROP TABLE todos;--";
    const query = makeQuery([todoRow]);

    await handleEvent(appSyncEvent('addTodo', { title: evil }), query);

    expect(query.mock.calls[0][1].title).toBe(evil);
  });

  test('toggleTodo flips done', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([todoRow])
      .mockResolvedValueOnce([{ ...todoRow, done: true }]) as any;

    const result = (await handleEvent(appSyncEvent('toggleTodo', { id: 'abc-123' }), query)) as any;

    expect(query.mock.calls[0][0]).toBe('getTodo');
    expect(query.mock.calls[1][0]).toBe('toggleTodo');
    expect(query.mock.calls[1][1]).toEqual({ id: 'abc-123', done: true });
    expect(result.done).toBe(true);
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
