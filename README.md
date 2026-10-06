# CDK + AppSync + Lambda + Aurora — GraphQL SQL demo

A small **learning / example repo** showing how to wire together:

**TypeScript · AWS CDK · AppSync GraphQL · Lambda resolvers · Aurora Serverless v2 PostgreSQL**

## What you can learn from this repo

- Infrastructure as code: a multi-construct CDK app in TypeScript
- Schema-first GraphQL with AppSync (the service validates requests before Lambda runs)
- One TypeScript Lambda serving many GraphQL fields (dispatch on `fieldName`)
- Talking to a SQL database from Lambda without a VPC — the **RDS Data API** (HTTPS)
- Parameterized SQL (injection safety — see the test suite)
- Deploy-time DDL/seeding via a CloudFormation **custom resource**
- Cost-aware defaults: zero NAT gateways, destroy removes everything

## Architecture

```
Client (curl / AppSync console)
   │  GraphQL over HTTPS + x-api-key
   ▼
AppSync GraphQL API ── schema: graphql/schema.graphql
   │  direct Lambda resolver (event carries typeName + fieldName)
   ▼
Lambda  lambda/handler.ts ── switch on field name → SQL
   │  RDS Data API (HTTPS, named bind parameters)
   ▼
Aurora Serverless v2 PostgreSQL (private subnets, 0.5–2 ACU)

Deploy-time: CloudFormation → Custom::TodoSeed → lambda/seed-handler.ts
             (CREATE TABLE IF NOT EXISTS + sample rows, idempotent)
```

## Project layout

| Path | Role |
|---|---|
| `bin/cdk-demo.ts` | CDK app entrypoint |
| `lib/cdk-demo-stack.ts` | Composes the three constructs + outputs (URL, API key) |
| `lib/database.ts` | VPC (no NAT) + Aurora cluster + Data API flag |
| `lib/graphql-api.ts` | AppSync API, schema, Lambda data source, 4 resolvers |
| `lib/seed.ts` | Custom resource that creates/seeds the table on deploy |
| `graphql/schema.graphql` | The GraphQL contract |
| `lambda/handler.ts` | Resolver dispatch (`handleEvent` is pure & tested) |
| `lambda/db.ts` | Thin Data API wrapper |
| `lambda/seed-handler.ts` | DDL + sample rows |
| `test/` | CloudFormation template assertions + handler unit tests |

## Commands

| Action | Command |
|---|---|
| Install deps | `bun install` |
| Type-check | `bun run build` |
| Watch & type-check | `bun run watch` |
| Tests | `bun run test` |
| Synthesize template | `npx cdk synth` (writes `cdk.out/`) |
| Deploy | `npx cdk deploy` |
| Destroy | `npx cdk destroy` |

Verification order: `build` → `test` → `synth`. (`cdk.json` runs `tsc` before the
app, so type errors also block synth.)

## Running it locally (no AWS account needed)

```bash
bun install
bun run build   # type-check
bun run test    # 14 tests — template shape + resolver logic
npx cdk synth   # emits cdk.out/CdkDemoStack.template.json
```

The Lambda handlers are bundled with **esbuild** during tests and synth — no
Docker required.

## Deploying (later, needs an AWS account)

```bash
npx cdk bootstrap   # once per account/region
npx cdk deploy
```

Outputs: `GraphQLUrl`, `GraphQLApiKey`.

```bash
curl -X POST "$GRAPHQL_URL" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{"query":"{ listTodos { id title done createdAt } }"}'
```

```bash
curl -X POST "$GRAPHQL_URL" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{"query":"mutation { addTodo(title: \"Learn AppSync\") { id title } }"}'
```

## ⚠️ Cost warning

While deployed, Aurora Serverless v2 runs 24/7 at its minimum (0.5 ACU ≈
**~$35/month**). The stack deliberately has **no NAT gateways** (saves ~$32/mo)
and everything has `removalPolicy: DESTROY`, so when you're done:

```bash
npx cdk destroy   # removes the database, API, Lambdas, VPC — everything
```

## Extending it (the intended exercise)

Add a `deleteTodo(id)` mutation:

1. `graphql/schema.graphql` — add `deleteTodo(id: ID!): Boolean!` to `Mutation`
2. `lib/graphql-api.ts` — `dataSource.createResolver('DeleteTodo', { typeName: 'Mutation', fieldName: 'deleteTodo' })`
3. `lambda/handler.ts` — new `case 'deleteTodo'` with a parameterized `DELETE … RETURNING`
4. `test/handler.test.ts` — new test with the injected fake query fn
5. `bun run build && bun run test && npx cdk synth`
