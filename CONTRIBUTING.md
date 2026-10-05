# Contributing to Mainspring App

## Before you start

- Comment on the issue you want so it can be assigned to you.
- If an issue's acceptance criteria are unclear, ask on the issue before writing code.
- Changes that need a contract change belong in [mainspring-contracts](https://github.com/mainspring-labs/mainspring-contracts) first. Issues that span both repos say so with a "Depends on" line.

## Setup

Node 22+ and pnpm 11.

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test
```

Live tests read the v0.1.0 testnet deployment: `MAINSPRING_LIVE=1 pnpm --filter @mainspring-labs/sdk test`.

## Code rules

- TypeScript strict mode, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`; narrow `unknown` instead.
- Hashes are lowercase hex strings at the SDK boundary. Ledger timestamps and amounts stay `bigint`.
- Never fetch a contract's interface from the network. Regenerate `packages/sdk/src/spec.ts` with `pnpm --filter @mainspring-labs/sdk gen:spec <version>` when the contracts release.
- New SDK functions need unit tests. Anything that talks to RPC also gets a case in `test/live.test.ts`.
- The CLI has no runtime dependencies beyond the SDK.

## Commits and PRs

- One logical change per commit.
- Conventional commits: `type(scope): description`. Scopes: `sdk`, `cli`, `web`, `indexer`, `workspace`.
- Stage files by name. Don't `git add .`.
- `pnpm build && pnpm typecheck && pnpm test` must pass. CI runs the same steps.
- Reference the issue in the PR description (`Closes #12`).
