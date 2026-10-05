import { describe, expect, it } from "vitest";

import { followsTag, type InstanceStatus } from "../src/instance.js";
import { parseProposal, parseTagState, parseVersionRecord } from "../src/spring.js";

const A = new Uint8Array(32).fill(1);
const B = new Uint8Array(32).fill(2);
const SPRING = "CB7F7Y3EO4V7S3DV2CFPJW6DSS3X4RYDPUGHS3QXMCBNG4B6KYCGV4SM";

describe("spring parsers", () => {
  it("maps tag state and hex-encodes hashes", () => {
    expect(parseTagState({ min_delay: 300n, version: 2, current: B, previous: A })).toEqual({
      minDelay: 300n,
      version: 2,
      current: "02".repeat(32),
      previous: "01".repeat(32),
    });
  });

  it("maps a missing rollback target to null", () => {
    expect(parseTagState({ min_delay: 0n, version: 1, current: A }).previous).toBeNull();
    expect(parseTagState({ min_delay: 0n, version: 1, current: A, previous: null }).previous).toBeNull();
  });

  it("maps proposals and version records", () => {
    expect(parseProposal({ wasm_hash: B, proposed_at: 10n, eta: 310n })).toEqual({
      wasmHash: "02".repeat(32),
      proposedAt: 10n,
      eta: 310n,
    });
    expect(
      parseVersionRecord(3, { wasm_hash: A, activated_at: 99n, kind: { tag: "Rollback" } }),
    ).toEqual({ version: 3, wasmHash: "01".repeat(32), activatedAt: 99n, kind: "Rollback" });
  });
});

describe("followsTag", () => {
  const following: InstanceStatus = {
    mode: "following",
    contractId: "C1",
    owner: SPRING,
    tag: "tipjar",
    wasmHash: "aa",
  };

  it("matches only the same owner and tag", () => {
    expect(followsTag(following, SPRING, "tipjar")).toBe(true);
    expect(followsTag(following, SPRING, "other")).toBe(false);
    expect(followsTag(following, "COTHER", "tipjar")).toBe(false);
  });

  it("is false for fixed and asset contracts", () => {
    expect(followsTag({ mode: "fixed", contractId: "C1", wasmHash: "aa" }, SPRING, "tipjar")).toBe(
      false,
    );
    expect(followsTag({ mode: "stellar-asset", contractId: "C1" }, SPRING, "tipjar")).toBe(false);
  });
});
