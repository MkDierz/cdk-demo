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

AppSync GraphQL → single TypeScript Lambda resolver (`lambda/handler.ts`) → PostgreSQL accessed via a standard Postgres client (`pg` in `lambda/db.ts`). The Lambda wiring is thin (`handler` exports the AWS Lambda entry; `handleEvent` is pure/injectable).

Key paths: `lib/` constructs (`database.ts`, `graphql-api.ts`, `seed.ts`) composed by `cdk-demo-stack.ts`; `graphql/schema.graphql`; `lambda/` (`handler.ts`, `db.ts`, `seed-handler.ts`). Bundling via esbuild (NodejsFunction).

## External Postgres (current implementation)

- DB access uses **normal Postgres client** (`pg`) with connection params (host/port/user/password/database/ssl) from env vars `DB_HOST`, `DB_PORT` (default 5432), `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default `postgres`), `DB_SSL` (`true`/`false`).
- `lambda/db.ts` exports `dbConfigFromEnv()`, `runQuery(config, sql, params)`, and `withTransaction(config, fn)` for atomic operations. SQL uses **parameterized queries** with `$1, $2, ...` (Postgres style). The `query` function returns `any[][]` for compatibility with the injected test shape.
- `handleEvent(event, query)` is pure and injectable; tests pass a fake `QueryFn` (no AWS, no module mocks). Keep this pattern.
- Lambda environment is built by `dbEnvironment()` in `lib/database.ts` and consumed by Lambda functions. For externally hosted DB, this supplies the Postgres connection vars (not RDS Data API ARNs).
- Seed runs as `Custom::TodoSeed` (custom resource). Bump `schemaVersion` in `cdk-demo-stack.ts` to re-run seed SQL.

## Gotchas

- **Secret exposure warning from CDK**: `dbEnvironment()` currently passes `cluster.secret.secretValueFromJson('password').toString()` into Lambda env. This is a CDK synthesis warning (risk of exposing secret in template). Treat secrets appropriately in real deployments (e.g. Secrets Manager reference resolved at runtime or inject via secure means). The demo/tests still work; don’t ignore in production contexts.
- **Bundling**: NodejsFunction bundles at test time (`Template.fromStack`) and at synth (esbuild). Keep esbuild as devDependency.
- **VPC/NAT**: Stack still creates VPC; external Postgres over private network may require Lambda in VPC. Current code does not force Lambda into VPC unless props passed (graphql-api/seed accept optional vpc/vpcSubnets) — adjust as needed for your external DB access pattern.
- **CDK tests**: Template assertions expect specific resources (AppSync, 4 resolvers, Node 22, seed custom resource). If changing infra, update tests accordingly.
- **Atomic changes**: Use `withTransaction()` when modifying multiple tables/rows that must commit atomically.

## Style & Verification

- Preserve parameterization — never interpolate user input into SQL.
- Handler stays pure (`handleEvent`). Return shapes match GraphQL (id/title/done/createdAt).
- Verification: `build` → `test` → `synth`. Run these after changes.
- Never commit changes unless explicitly requested.
