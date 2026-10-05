import { rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";

import { toHex } from "./bytes.js";

interface EventMeta {
  contractId: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  id: string;
}

/** Every event mainspring-contracts v0.1.0 emits, decoded. */
export type MainspringEvent = EventMeta &
  (
    | { name: "tag_created"; tag: string; wasmHash: string; minDelay: bigint }
    | { name: "upgrade_proposed"; tag: string; wasmHash: string; eta: bigint }
    | { name: "upgrade_executed"; tag: string; version: number; wasmHash: string }
    | { name: "upgrade_cancelled"; tag: string; by: string }
    | { name: "rolled_back"; tag: string; version: number; wasmHash: string; by: string }
    | { name: "min_delay_increased"; tag: string; minDelay: bigint }
    | { name: "admin_transfer_started"; current: string; pending: string }
    | { name: "admin_transferred"; previous: string; admin: string }
    | { name: "guardian_changed"; previous: string; guardian: string }
    | {
        name: "instance_deployed";
        spring: string;
        tag: string;
        instance: string;
        deployer: string;
        index: number;
      }
    | { name: "attached"; owner: string; tag: string }
    | { name: "pinned"; wasmHash: string }
  );

export type MainspringEventName = MainspringEvent["name"];

type Data = Record<string, unknown>;

const hex = (v: unknown): string => toHex(v as Uint8Array);
const str = (v: unknown): string => String(v);
const num = (v: unknown): number => Number(v);
const big = (v: unknown): bigint => BigInt(v as bigint);

/**
 * Decode one RPC event. Returns null for events that are not Mainspring's,
 * so callers can scan a mixed stream.
 */
export function decodeEvent(event: rpc.Api.EventResponse): MainspringEvent | null {
  const topics = event.topic.map((t: xdr.ScVal) => scValToNative(t) as unknown);
  const name = topics[0];
  if (typeof name !== "string") {
    return null;
  }
  const meta: EventMeta = {
    contractId: event.contractId?.contractId() ?? "",
    ledger: event.ledger,
    ledgerClosedAt: event.ledgerClosedAt,
    txHash: event.txHash,
    id: event.id,
  };
  const d = (scValToNative(event.value) ?? {}) as Data;
  const t1 = topics[1];
  const t2 = topics[2];

  switch (name) {
    case "tag_created":
      return { ...meta, name, tag: str(t1), wasmHash: hex(d.wasm_hash), minDelay: big(d.min_delay) };
    case "upgrade_proposed":
      return { ...meta, name, tag: str(t1), wasmHash: hex(d.wasm_hash), eta: big(d.eta) };
    case "upgrade_executed":
      return { ...meta, name, tag: str(t1), version: num(d.version), wasmHash: hex(d.wasm_hash) };
    case "upgrade_cancelled":
      return { ...meta, name, tag: str(t1), by: str(d.by) };
    case "rolled_back":
      return {
        ...meta,
        name,
        tag: str(t1),
        version: num(d.version),
        wasmHash: hex(d.wasm_hash),
        by: str(d.by),
      };
    case "min_delay_increased":
      return { ...meta, name, tag: str(t1), minDelay: big(d.min_delay) };
    case "admin_transfer_started":
      return { ...meta, name, current: str(d.current), pending: str(d.pending) };
    case "admin_transferred":
      return { ...meta, name, previous: str(d.previous), admin: str(d.admin) };
    case "guardian_changed":
      return { ...meta, name, previous: str(d.previous), guardian: str(d.guardian) };
    case "instance_deployed":
      return {
        ...meta,
        name,
        spring: str(t1),
        tag: str(t2),
        instance: str(d.instance),
        deployer: str(d.deployer),
        index: num(d.index),
      };
    case "attached":
      return { ...meta, name, owner: str(t1), tag: str(t2) };
    case "pinned":
      return { ...meta, name, wasmHash: hex(d.wasm_hash) };
    default:
      return null;
  }
}

export interface ScanOptions {
  /** Contracts to read events from: springs, factories or instances. */
  contractIds: string[];
  /** First ledger to scan. Ignored when `cursor` is set. */
  startLedger?: number;
  /** Resume point returned by a previous scan. */
  cursor?: string;
  /** Events per RPC page. */
  pageSize?: number;
}

export interface ScanResult {
  events: MainspringEvent[];
  /** Pass to the next scan to continue where this one stopped. */
  cursor: string;
  latestLedger: number;
}

/**
 * Read Mainspring events up to the RPC's latest ledger.
 *
 * RPC scans a bounded ledger window per request and returns a cursor even
 * when the page is empty, so this follows cursors until it reaches the
 * latest ledger.
 */
export async function scanEvents(server: rpc.Server, opts: ScanOptions): Promise<ScanResult> {
  const filters: rpc.Api.EventFilter[] = [{ type: "contract", contractIds: opts.contractIds }];
  const limit = opts.pageSize ?? 100;
  let request: rpc.Server.GetEventsRequest = opts.cursor
    ? { filters, cursor: opts.cursor, limit }
    : { filters, startLedger: opts.startLedger ?? 0, limit };

  const events: MainspringEvent[] = [];
  for (;;) {
    const page = await server.getEvents(request);
    for (const raw of page.events) {
      const decoded = decodeEvent(raw);
      if (decoded) {
        events.push(decoded);
      }
    }
    const reachedTip = cursorLedger(page.cursor) >= page.latestLedger;
    if (page.events.length < limit && reachedTip) {
      return { events, cursor: page.cursor, latestLedger: page.latestLedger };
    }
    if (page.cursor === cursorOf(request)) {
      return { events, cursor: page.cursor, latestLedger: page.latestLedger };
    }
    request = { filters, cursor: page.cursor, limit };
  }
}

/** The ledger a TOID-style event cursor points into. */
export function cursorLedger(cursor: string): number {
  const toid = cursor.split("-")[0] ?? "0";
  return Number(BigInt(toid) >> 32n);
}

function cursorOf(request: rpc.Server.GetEventsRequest): string | undefined {
  return "cursor" in request ? request.cursor : undefined;
}
