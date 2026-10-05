# Security Policy

## Audit status

Not audited. This repo only reads chain state and never signs or submits transactions, but people may decide whether to pin a contract based on what it reports. A wrong answer here is a security bug.

## Scope

In scope:

- The SDK or CLI reporting an instance as `fixed` when it follows a spring, or the reverse.
- Reporting the wrong spring, tag, Wasm hash, pending proposal or eta.
- `scanEvents` silently skipping events.
- Anything that makes the SDK trust a contract interface fetched from the network.

Contract bugs belong to [mainspring-contracts](https://github.com/mainspring-labs/mainspring-contracts/security).

## Reporting a vulnerability

Do not open a public issue. Use **Security → Report a vulnerability** on this repository. Include the network, the contract IDs involved, what the tool reported and what is actually on-chain. You'll get an acknowledgement within 72 hours.
