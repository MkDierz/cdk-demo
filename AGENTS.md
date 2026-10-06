# AGENTS.md: cdk-demo

## Commands

| Action | Command |
|---|---|
| Install deps | `bun install` (repo uses **bun** — `bun.lock`, use `bun add`, not npm) |
| Type-check | `bun run build` (`tsc`) |
| Watch | `bun run watch` (`tsc -w`) |
| Tests | `bun run test` (`jest`) |
| Synthesize CFN | `npx cdk synth` (emits `cdk.out/`) |
| Diff / deploy / destroy | `npx cdk diff` / `npx cdk deploy` / `npx cdk destroy` |

Verification order: **`build` → `test` → `synth`**. `cdk.json`'s app command runs
`npx tsc` before `tsx bin/cdk-demo.ts`, so type errors also block synth.

## Architecture (learning repo)

AppSync GraphQL → single TypeScript Lambda resolver → Aurora Serverless v2
PostgreSQL via the **RDS Data API** (HTTPS, so Lambda needs no VPC/NAT).

- `lib/` — one construct per concern: `database.ts`, `graphql-api.ts`,
  `seed.ts`, composed by `cdk-demo-stack.ts`
- `lambda/` — three esbuild-bundled entrypoints: `handler.ts` (dispatch),
  `db.ts` (Data API wrapper), `seed-handler.ts` (DDL)
- `graphql/schema.graphql` — AppSync validates requests against this before
  Lambda runs; resolvers only see fields that passed
- `test/cdk-demo.test.ts` — template assertions; `test/handler.test.ts` —
  pure `handleEvent` tests via an injected fake query fn (no AWS, no module mocks)

## Gotchas — things that look wrong but are intentional

- **`natGateways: 0`** in `lib/database.ts` — Data API is HTTPS; NAT would add
  ~$32/mo for nothing. A test asserts `AWS::EC2::NatGateway` count is 0. Don't "fix" it.
- **`bundling: { externalModules: [] }`** on both NodejsFunctions — bundles our
  pinned `@aws-sdk/client-rds-data` instead of relying on the runtime's copy.
- **Data API via escape hatch** — `enableHttpEndpoint` is not on the L2
  `DatabaseClusterProps`; it's set on the Cfn child in `lib/database.ts`.
- **`defaultDatabaseName`**, not `databaseName` — the L2 prop name for the
  initial database. `secret` exists only on concrete `rds.DatabaseCluster`,
  not on `IDatabaseCluster`.
- **esbuild is required** — `NodejsFunction` bundles at *test* time
  (`Template.fromStack`) and at synth. It's a devDependency; keep it that way.
- **Seed**: custom resource `Custom::TodoSeed` runs idempotent DDL on deploy.
  Bump `schemaVersion` in `lib/cdk-demo-stack.ts` to re-run seed SQL.

## Cost

Aurora Serverless v2 costs ~$35/mo while the stack exists (min 0.5 ACU).
`removalPolicy: DESTROY` — run `npx cdk destroy` after a deploy.

## Style notes

- Handler logic lives in a **pure, injectable** `handleEvent(event, query)` so
  unit tests never touch AWS; the exported `handler` is thin wiring.
- All SQL uses named bind parameters (`:id`) — never interpolate user input.
