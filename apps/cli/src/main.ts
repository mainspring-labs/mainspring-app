#!/usr/bin/env node
import { parseArgs } from "node:util";

import {
  FactoryReader,
  fleetReport,
  inspectInstance,
  mainnet,
  type Network,
  rpcServer,
  scanEvents,
  SpringReader,
  TESTNET,
} from "@mainspring-labs/sdk";

import {
  formatEvent,
  formatFleet,
  formatHistory,
  formatInstance,
  formatInstanceAdvice,
  formatTagState,
  toJson,
} from "./format.js";

const USAGE = `mainspring: watch Mainspring fleets on Stellar

Usage:
  mainspring fleet <factory-id>              spring state, pending upgrade, every instance
  mainspring tag <spring-id> <tag>           tag state, pending upgrade, version history
  mainspring instance <contract-id>          who controls this contract's code, and what is coming
  mainspring watch <factory-id>              stream fleet events; alerts on proposals

Options:
  --network testnet|mainnet   default testnet
  --rpc <url>                 RPC endpoint (required for mainnet)
  --json                      machine-readable output (fleet, tag, instance)
  --from-ledger <n>           watch: first ledger to read (default: latest - 1000)
  --interval <seconds>        watch: poll interval (default 15)
  --once                      watch: read up to the latest ledger, then exit
  -h, --help
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      network: { type: "string", default: "testnet" },
      rpc: { type: "string" },
      json: { type: "boolean", default: false },
      "from-ledger": { type: "string" },
      interval: { type: "string", default: "15" },
      once: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const [command, ...args] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }

  const network = resolveNetwork(values.network, values.rpc);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const print = (lines: string[]) => process.stdout.write(`${lines.join("\n")}\n`);

  switch (command) {
    case "fleet": {
      const report = await fleetReport(required(args[0], "factory-id"), network);
      print(values.json ? [toJson(report)] : formatFleet(report, now));
      return 0;
    }
    case "tag": {
      const spring = new SpringReader(required(args[0], "spring-id"), network);
      const tag = required(args[1], "tag");
      const [state, pending, history] = await Promise.all([
        spring.tag(tag),
        spring.pending(tag),
        spring.history(tag),
      ]);
      print(
        values.json
          ? [toJson({ tag, state, pending, history })]
          : [...formatTagState(tag, state, pending, now), "", "history", ...formatHistory(history)],
      );
      return 0;
    }
    case "instance": {
      const status = await inspectInstance(rpcServer(network), required(args[0], "contract-id"));
      const pending =
        status.mode === "following"
          ? await new SpringReader(status.owner, network).pending(status.tag).catch(() => null)
          : null;
      print(
        values.json
          ? [toJson({ status, pending })]
          : [formatInstance(status), "", ...formatInstanceAdvice(status, pending, now)],
      );
      return 0;
    }
    case "watch":
      return watch(required(args[0], "factory-id"), network, {
        fromLedger: values["from-ledger"] ? Number(values["from-ledger"]) : undefined,
        intervalMs: Number(values.interval) * 1000,
        once: values.once,
      });
    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

async function watch(
  factoryId: string,
  network: Network,
  opts: { fromLedger: number | undefined; intervalMs: number; once: boolean },
): Promise<number> {
  const server = rpcServer(network);
  const factory = new FactoryReader(factoryId, network);
  const { spring, tag } = await factory.fleet();
  const watched = new Set([spring, factoryId, ...(await factory.instances())]);

  let startLedger = opts.fromLedger;
  if (startLedger === undefined) {
    startLedger = Math.max(1, (await server.getLatestLedger()).sequence - 1000);
  }
  process.stdout.write(
    `watching ${tag} on ${spring} (${watched.size - 2} instances) from ledger ${startLedger}\n`,
  );

  let cursor: string | undefined;
  for (;;) {
    const contractIds = [...watched];
    const result = await scanEvents(
      server,
      cursor ? { contractIds, cursor } : { contractIds, startLedger },
    );
    for (const e of result.events) {
      process.stdout.write(`${formatEvent(e)}\n`);
      if (e.name === "instance_deployed") {
        watched.add(e.instance);
      }
    }
    cursor = result.cursor;
    if (opts.once) {
      return 0;
    }
    await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
  }
}

function resolveNetwork(name: string | undefined, rpc: string | undefined): Network {
  if (name === "mainnet") {
    if (!rpc) {
      throw new UsageError("--rpc is required for mainnet: SDF runs no public mainnet RPC");
    }
    return mainnet(rpc);
  }
  if (name !== "testnet") {
    throw new UsageError(`unknown network: ${name}`);
  }
  return rpc ? { ...TESTNET, rpcUrl: rpc } : TESTNET;
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new UsageError(`missing <${name}>`);
  }
  return value;
}

class UsageError extends Error {}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n\n${USAGE}`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  },
);
