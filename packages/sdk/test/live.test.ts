import { describe, expect, it } from "vitest";

import { fleetReport, rpcServer, scanEvents, TESTNET } from "../src/index.js";

// The v0.1.0 testnet deployment from the mainspring-contracts release notes.
const FACTORY = "CAE74DKXJYMTZ6OJ6DF2Q6DTFPBDUXOZENUJQK2GZFWSNQPJE4UA7XUS";
const SPRING = "CB7F7Y3EO4V7S3DV2CFPJW6DSS3X4RYDPUGHS3QXMCBNG4B6KYCGV4SM";
const PINNED = "CAMZPAWBPUYU3BZK4W3GNKTJEZ6MK2I2KI6NYERVLLJWV3QW3LTIEOPP";
const FOLLOWING = "CDE4YPRRUNZYEJQAEYJBX5ENU3QQWTP7Q7CC6RJJTRRI3LMWLPAZ4SQA";
const V1 = "42cf40372934c8327de49bb72446d3aa6e2c8986bacb349bb0a1bc9a4d2c6a16";
const V2 = "f39a78d20877024ac6a748cf752b6dbe70c007958d17dd5bab08aab4ebe2f24d";

// Hits the public testnet RPC. Run with MAINSPRING_LIVE=1.
describe.runIf(process.env.MAINSPRING_LIVE === "1")("testnet v0.1.0 deployment", () => {
  it("reports the pinned and following instances", async () => {
    const report = await fleetReport(FACTORY, TESTNET);
    expect(report.spring).toBe(SPRING);
    expect(report.tag).toBe("tipjar");
    expect(report.state.current).toBe(V2);
    expect(report.state.previous).toBe(V1);
    expect(report.instances).toContainEqual({ mode: "fixed", contractId: PINNED, wasmHash: V1 });
    expect(report.instances).toContainEqual({
      mode: "following",
      contractId: FOLLOWING,
      owner: SPRING,
      tag: "tipjar",
      wasmHash: V2,
    });
    expect(report.following).toBe(1);
    expect(report.fixed).toBe(1);
  }, 60_000);

  it("scans the upgrade history", async () => {
    const { events } = await scanEvents(rpcServer(TESTNET), {
      contractIds: [SPRING, FACTORY, PINNED],
      startLedger: 5036800,
    });
    expect(events.map((e) => e.name)).toEqual([
      "tag_created",
      "instance_deployed",
      "instance_deployed",
      "upgrade_proposed",
      "pinned",
      "upgrade_executed",
    ]);
  }, 60_000);
});
