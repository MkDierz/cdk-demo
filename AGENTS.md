# AGENTS.md: cdk-demo

## Commands

| Action | Command |
|---|---|
| Install deps | `bun install` (repo uses **bun** — `bun.lock`; use `bun add`, not npm) |
| Type-check/build | `bun run build` (`tsc`) |
| Watch | `bun run watch` (`tsc -w`) |
| Tests | `bun run test` (`jest`) |
| Synthesize CFN | `npx cdk synth` (emits `cdk.out/`) |
| Diff/deploy/destroy | `npx cdk diff` / `npx cdk deploy` / `npx cdk destroy` |

Verification order: **`build` → `test` → `synth`**. `cdk.json` runs `npx tsc` before `tsx bin/cdk-demo.ts`, so type errors block synth.

## Architecture

AppSync GraphQL → single TypeScript Lambda resolver (`lambda/handler.ts`) → DynamoDB (`cdk-demo-todos` table). The Lambda wiring is thin (`handler` exports the AWS Lambda entry; `handleEvent` is pure/injectable).

Key paths: `lib/` constructs (`database.ts`, `graphql-api.ts`, `seed.ts`) composed by `cdk-demo-stack.ts`; `graphql/schema.graphql`; `lambda/` (`handler.ts`, `db.ts`, `seed-handler.ts`). Bundling via esbuild (NodejsFunction).

## DynamoDB (current implementation)

- DynamoDB table created in `lib/database.ts` with partition key `id` (string), billing mode PAY_PER_REQUEST, and removalPolicy DESTROY. Table name is `cdk-demo-todos`.
- Lambda environment: `TABLE_NAME` set via `dbEnvironment(tableName)`. Lambdas get `table.grantReadWriteData()`.
- Data access (`lambda/db.ts`) uses AWS SDK v3 DynamoDB DocumentClient: `ScanCommand`, `GetCommand`, `PutCommand`, `UpdateCommand`. `runOperation(config, operation, params)` implements operations: `listTodos`, `getTodo`, `addTodo`, `toggleTodo`. `listTodos` sorts by `createdAt`/`created_at` descending in memory (small demo dataset).
- `handleEvent(event, query)` is pure and injectable. It generates `id` (UUID) and `createdAt` (ISO string) on insert; toggling fetches current state and sets `done = !done`. Tests pass a fake `QueryFn` (no AWS, no module mocks).
- Seed (`lambda/seed-handler.ts`) runs as `Custom::TodoSeed` custom resource; it scans table and inserts initial items only if empty. Bump `schemaVersion` in `cdk-demo-stack.ts` to re-run if needed.

## Gotchas

- `listTodos` uses `ScanCommand` (demo only). For production use Query with appropriate indexes.
- Bundling: NodejsFunction bundles at test time (`Template.fromStack`) and at synth (esbuild). Keep esbuild as devDependency.
- CDK tests expect AppSync (4 resolvers), Node 22, DynamoDB table, and seed custom resource.

## Style & Verification

- Keep handler pure (`handleEvent`). Return shapes match GraphQL (id/title/done/createdAt).
- Verification: `build` → `test` → `synth`. Run these after changes.
- Never commit changes unless explicitly requested.
