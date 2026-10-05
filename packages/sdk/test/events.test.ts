import { Contract, Keypair, nativeToScVal, type rpc, type xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { cursorLedger, decodeEvent } from "../src/events.js";

const SPRING = "CB7F7Y3EO4V7S3DV2CFPJW6DSS3X4RYDPUGHS3QXMCBNG4B6KYCGV4SM";
const HASH = new Uint8Array(32).fill(0xab);
const HASH_HEX = "ab".repeat(32);
const ACCOUNT = Keypair.random().publicKey();

const sym = (s: string) => nativeToScVal(s, { type: "symbol" });
const strv = (s: string) => nativeToScVal(s, { type: "string" });

function event(topic: xdr.ScVal[], value: xdr.ScVal): rpc.Api.EventResponse {
  return {
    id: "0021612477296934911-0000000001",
    type: "contract",
    ledger: 5036873,
    ledgerClosedAt: "2026-10-05T13:50:52Z",
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "36395c26",
    contractId: new Contract(SPRING),
    topic,
    value,
  };
}

function map(entries: Record<string, [unknown, string]>): xdr.ScVal {
  const value: Record<string, unknown> = {};
  const type: Record<string, [string, string]> = {};
  for (const [k, [v, t]] of Object.entries(entries)) {
    value[k] = v;
    type[k] = ["symbol", t];
  }
  return nativeToScVal(value, { type });
}

describe("decodeEvent", () => {
  it("decodes upgrade_proposed with tag topic and eta", () => {
    const decoded = decodeEvent(
      event(
        [sym("upgrade_proposed"), strv("tipjar")],
        map({ wasm_hash: [HASH, "bytes"], eta: [1791208252n, "u64"] }),
      ),
    );
    expect(decoded).toMatchObject({
      name: "upgrade_proposed",
      tag: "tipjar",
      wasmHash: HASH_HEX,
      eta: 1791208252n,
      contractId: SPRING,
      ledger: 5036873,
      txHash: "36395c26",
    });
  });

  it("decodes rolled_back with version and caller", () => {
    const decoded = decodeEvent(
      event(
        [sym("rolled_back"), strv("tipjar")],
        map({
          version: [3, "u32"],
          wasm_hash: [HASH, "bytes"],
          by: [ACCOUNT, "address"],
        }),
      ),
    );
    expect(decoded).toMatchObject({ name: "rolled_back", version: 3, by: ACCOUNT });
  });

  it("decodes instance_deployed with spring and tag topics", () => {
    const decoded = decodeEvent(
      event(
        [sym("instance_deployed"), nativeToScVal(SPRING, { type: "address" }), strv("tipjar")],
        map({
          instance: [SPRING, "address"],
          deployer: [ACCOUNT, "address"],
          index: [4, "u32"],
        }),
      ),
    );
    expect(decoded).toMatchObject({
      name: "instance_deployed",
      spring: SPRING,
      tag: "tipjar",
      deployer: ACCOUNT,
      index: 4,
    });
  });

  it("decodes pinned", () => {
    const decoded = decodeEvent(event([sym("pinned")], map({ wasm_hash: [HASH, "bytes"] })));
    expect(decoded).toMatchObject({ name: "pinned", wasmHash: HASH_HEX });
  });

  it("returns null for events it does not know", () => {
    expect(decodeEvent(event([sym("transfer")], nativeToScVal(1)))).toBeNull();
    expect(decodeEvent(event([nativeToScVal(7, { type: "u32" })], nativeToScVal(1)))).toBeNull();
  });
});

describe("cursorLedger", () => {
  it("reads the ledger from the high 32 bits of the TOID", () => {
    expect(cursorLedger("0021612477296934911-4294967295")).toBe(5032046);
    expect(cursorLedger(((5036945n << 32n) | 7n).toString() + "-0")).toBe(5036945);
  });
});
