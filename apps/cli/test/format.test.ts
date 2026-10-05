import type { InstanceStatus, Proposal } from "@mainspring-labs/sdk";
import { describe, expect, it } from "vitest";

import {
  describeEta,
  formatDuration,
  formatInstanceAdvice,
  formatTagState,
  toJson,
} from "../src/format.js";

const SPRING = "CB7F7Y3EO4V7S3DV2CFPJW6DSS3X4RYDPUGHS3QXMCBNG4B6KYCGV4SM";
const following: InstanceStatus = {
  mode: "following",
  contractId: "CDE4YPRRUNZYEJQAEYJBX5ENU3QQWTP7Q7CC6RJJTRRI3LMWLPAZ4SQA",
  owner: SPRING,
  tag: "tipjar",
  wasmHash: "aa".repeat(32),
};
const pending: Proposal = { wasmHash: "bb".repeat(32), proposedAt: 1_000n, eta: 260_200n };

describe("formatDuration", () => {
  it("formats days, hours and minutes", () => {
    expect(formatDuration(259_200n)).toBe("3d 0h 0m");
    expect(formatDuration(3_725n)).toBe("1h 2m");
    expect(formatDuration(300n)).toBe("5m 00s");
    expect(formatDuration(65n)).toBe("1m 05s");
  });

  it("returns now for zero or negative", () => {
    expect(formatDuration(0n)).toBe("now");
    expect(formatDuration(-5n)).toBe("now");
  });
});

describe("describeEta", () => {
  it("counts down before the eta", () => {
    expect(describeEta(pending, 260_000n)).toContain("(in 3m 20s)");
  });

  it("says execute is waiting once the eta has passed", () => {
    expect(describeEta(pending, 260_201n)).toContain("waiting for anyone to call execute");
  });
});

describe("formatInstanceAdvice", () => {
  it("tells the owner to pin before a pending eta", () => {
    const lines = formatInstanceAdvice(following, pending, 1_000n).join("\n");
    expect(lines).toContain(`controlled by ${SPRING}`);
    expect(lines).toContain(`upgrade to ${"bb".repeat(32)} is pending`);
    expect(lines).toContain("must call pin() before then");
  });

  it("drops the pin advice once the eta has passed", () => {
    const lines = formatInstanceAdvice(following, pending, 300_000n).join("\n");
    expect(lines).not.toContain("pin()");
  });

  it("says nothing is pending when there is no proposal", () => {
    expect(formatInstanceAdvice(following, null, 0n)).toContain("No upgrade is pending.");
  });

  it("explains that fixed contracts are out of reach", () => {
    const lines = formatInstanceAdvice(
      { mode: "fixed", contractId: "C1", wasmHash: "aa" },
      pending,
      0n,
    );
    expect(lines.join("\n")).toContain("Spring upgrades do not reach it.");
  });
});

describe("formatTagState", () => {
  it("marks a missing rollback target", () => {
    const lines = formatTagState(
      "tipjar",
      { minDelay: 300n, version: 3, current: "aa", previous: null },
      null,
      0n,
    );
    expect(lines).toContain("previous   none (rollback not available)");
    expect(lines).toContain("pending    none");
  });
});

describe("toJson", () => {
  it("serializes bigints as strings", () => {
    expect(JSON.parse(toJson({ eta: 260_200n }))).toEqual({ eta: "260200" });
  });
});
