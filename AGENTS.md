# AGENTS.md: cdk-demo

## Commands

| Action | Command |
|---|---|
| Type-check | `tsc` or `bun run build` |
| Watch & type-check | `tsc -w` or `bun run watch` |
| Run tests | `jest` or `bun run test` |
| Synthesize CFN | `npx cdk synth` |
| Diff deployed | `npx cdk diff` |
| Deploy | `npx cdk deploy` |

## Key project facts

- **Test file**: `test/cdk-demo.test.ts` is partially commented out — uncomment imports and the `test()` block to enable.
- **Jest uses SWC**: transformation via `@swc/jest` in `jest.config.js` (faster than ts-jest).
- **CDK context**: `cdk.json` sets many `@aws-cdk/*` context keys. Changing these requires `cdk synth` re-run.
- **No `babel` or `ts-jest`**: swc handles compilation; do not configure babel/jest transforms interchangeably.
- **Env**: Stack is environment-agnostic by default (`cdk-demo.ts` leaves `env` commented out). Uncomment `env` for account/region-dependent features.

## Workflow order

`build` (type-check) → `test` → `cdk synth` → `cdk diff` → `cdk deploy`

## Test prerequisites

- Test resource (SQS queue) is commented out in `lib/cdk-demo-stack.ts` — uncomment the `// const queue` block if you want the test to pass.
- Test uses `aws-cdk-lib/testhelpers/jest-autoclean` via `setupFilesAfterEnv`.
