import { contract } from "@stellar/stellar-sdk";

import { toHex } from "./bytes.js";
import { ContractError } from "./errors.js";
import { type Network, rpcServer } from "./network.js";
import { SPRING_SPEC } from "./spec.js";

export type VersionKind = "Created" | "Upgrade" | "Rollback";

export interface TagState {
  /** Timelock in seconds. Only ever increases. */
  minDelay: bigint;
  version: number;
  /** Wasm hash every following instance runs now. */
  current: string;
  /** Rollback target, or null right after a rollback. */
  previous: string | null;
}

export interface Proposal {
  wasmHash: string;
  /** Ledger timestamp, seconds. */
  proposedAt: bigint;
  /** Earliest ledger timestamp `execute` succeeds at. */
  eta: bigint;
}

export interface VersionRecord {
  version: number;
  wasmHash: string;
  activatedAt: bigint;
  kind: VersionKind;
}

interface RawTagState {
  min_delay: bigint;
  version: number;
  current: Uint8Array;
  previous?: Uint8Array | null;
}

interface RawProposal {
  wasm_hash: Uint8Array;
  proposed_at: bigint;
  eta: bigint;
}

interface RawVersionRecord {
  wasm_hash: Uint8Array;
  activated_at: bigint;
  kind: { tag: VersionKind };
}

export function parseTagState(raw: RawTagState): TagState {
  return {
    minDelay: raw.min_delay,
    version: raw.version,
    current: toHex(raw.current),
    previous: raw.previous ? toHex(raw.previous) : null,
  };
}

export function parseProposal(raw: RawProposal): Proposal {
  return {
    wasmHash: toHex(raw.wasm_hash),
    proposedAt: raw.proposed_at,
    eta: raw.eta,
  };
}

export function parseVersionRecord(version: number, raw: RawVersionRecord): VersionRecord {
  return {
    version,
    wasmHash: toHex(raw.wasm_hash),
    activatedAt: raw.activated_at,
    kind: raw.kind.tag,
  };
}

/** Read-only client for a deployed spring contract. */
export class SpringReader {
  private readonly client: contract.Client;

  constructor(
    readonly contractId: string,
    network: Network,
  ) {
    this.client = new contract.Client(new contract.Spec(SPRING_SPEC), {
      contractId,
      networkPassphrase: network.networkPassphrase,
      rpcUrl: network.rpcUrl,
      allowHttp: network.allowHttp ?? false,
      server: rpcServer(network),
    });
  }

  async tag(tag: string): Promise<TagState> {
    const raw = await this.call<contract.Result<RawTagState>>("tag", { tag });
    if (raw.isErr()) {
      throw new ContractError("spring", "tag", raw.unwrapErr().message);
    }
    return parseTagState(raw.unwrap());
  }

  async pending(tag: string): Promise<Proposal | null> {
    const raw = await this.call<RawProposal | null | undefined>("pending", { tag });
    return raw ? parseProposal(raw) : null;
  }

  async version(tag: string, version: number): Promise<VersionRecord | null> {
    const raw = await this.call<RawVersionRecord | null | undefined>("version", {
      tag,
      version,
    });
    return raw ? parseVersionRecord(version, raw) : null;
  }

  /** Every version record for `tag`, oldest first. One read per version. */
  async history(tag: string): Promise<VersionRecord[]> {
    const state = await this.tag(tag);
    const records: VersionRecord[] = [];
    for (let v = 1; v <= state.version; v++) {
      const record = await this.version(tag, v);
      if (record) {
        records.push(record);
      }
    }
    return records;
  }

  async admin(): Promise<string> {
    return this.call<string>("admin", {});
  }

  async guardian(): Promise<string> {
    return this.call<string>("guardian", {});
  }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const method = (this.client as unknown as Record<string, unknown>)[fn];
    if (typeof method !== "function") {
      throw new Error(`spring spec has no function ${fn}`);
    }
    const tx = (await method.call(this.client, args)) as contract.AssembledTransaction<T>;
    return tx.result;
  }
}
