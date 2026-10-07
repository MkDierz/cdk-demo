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

AppSync GraphQL → single TypeScript Lambda resolver (`lambda/handler.ts`) → externally hosted PostgreSQL accessed via standard Postgres client (`pg` in `lambda/db.ts`). The Lambda wiring is thin (`handler` exports the AWS Lambda entry; `handleEvent` is pure/injectable).

Key paths: `lib/` constructs (`database.ts`, `graphql-api.ts`, `seed.ts`) composed by `cdk-demo-stack.ts`; `graphql/schema.graphql`; `lambda/` (`handler.ts`, `db.ts`, `seed-handler.ts`). Bundling via esbuild (NodejsFunction).

## External Postgres (current implementation)

- No RDS cluster is provisioned. `lib/database.ts` creates/holds an external DB config (host/port/database) and a Secrets Manager secret that stores credentials (e.g. `username`, `password`, `host`, `port`, `dbname`). In demos, the secret is generated; in real deployments reference an existing secret.
- DB access uses **normal Postgres client** (`pg`). `lambda/db.ts` reads connection details from env vars: `DB_HOST`, `DB_PORT` (default 5432), `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default `postgres`), `DB_SSL` (`true`/`false`). If credentials are stored in Secrets Manager, Lambdas can read `DB_SECRET_ARN` and fetch them at runtime (extend `db.ts` as needed).
- `lambda/db.ts` exports `dbConfigFromEnv()`, `runQuery(config, sql, params)`, and `withTransaction(config, fn)` for atomic operations. SQL uses **parameterized queries** with `$1, $2, ...`. The `query` function returns `any[][]` for compatibility with the injected test shape.
- `handleEvent(event, query)` is pure and injectable; tests pass a fake `QueryFn` (no AWS, no module mocks). Keep this pattern.
- Lambda environment is built by `dbEnvironmentFromSecret(host, port, databaseName, secret)` in `lib/database.ts` (sets `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SECRET_ARN`). Lambdas get `secret.grantRead()` and do not require RDS Data API access.
- Seed runs as `Custom::TodoSeed` (custom resource). Bump `schemaVersion` in `cdk-demo-stack.ts` to re-run seed SQL. Use `withTransaction()` when modifying multiple tables/rows that must commit atomically.

## Gotchas

- **Secret exposure warning from CDK**: Avoid passing raw passwords in plain Lambda env vars from CDK if sourced from Secrets Manager in production. Prefer resolving secrets at runtime or passing only references; the current demo generates a secret and passes `DB_SECRET_ARN` (and may also expose via generated secret values in templates). Treat secrets appropriately.
- **Bundling**: NodejsFunction bundles at test time (`Template.fromStack`) and at synth (esbuild). Keep esbuild as devDependency.
- **VPC/NAT**: Stack may still create VPC if needed for private external DB access; `graphql-api.ts` and `seed.ts` accept optional `vpc`/`vpcSubnets`. No NAT required if not routing to internet.
- **CDK tests**: Template assertions expect AppSync (4 resolvers), Node 22, and seed custom resource. If changing infra, update tests accordingly.
- **Atomic changes**: Use `withTransaction()` when modifying multiple tables/rows that must commit atomically.

## Style & Verification

- Preserve parameterization — never interpolate user input into SQL.
- Handler stays pure (`handleEvent`). Return shapes match GraphQL (id/title/done/createdAt).
- Verification: `build` → `test` → `synth`. Run these after changes.
- Never commit changes unless explicitly requested.
