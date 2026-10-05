import type {
  FleetReport,
  InstanceStatus,
  MainspringEvent,
  Proposal,
  TagState,
  VersionRecord,
} from "@mainspring-labs/sdk";

/** "2d 4h 10m", "4m 05s", or "now" once `seconds` is not positive. */
export function formatDuration(seconds: bigint): string {
  if (seconds <= 0n) {
    return "now";
  }
  const d = seconds / 86_400n;
  const h = (seconds % 86_400n) / 3_600n;
  const m = (seconds % 3_600n) / 60n;
  const s = seconds % 60n;
  if (d > 0n) {
    return `${d}d ${h}h ${m}m`;
  }
  if (h > 0n) {
    return `${h}h ${m}m`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatTime(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toISOString().replace(".000Z", "Z");
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/** One line on when a proposal lands, relative to `now` (unix seconds). */
export function describeEta(pending: Proposal, now: bigint): string {
  const left = pending.eta - now;
  return left > 0n
    ? `executable at ${formatTime(pending.eta)} (in ${formatDuration(left)})`
    : `executable since ${formatTime(pending.eta)}, waiting for anyone to call execute`;
}

export function formatTagState(tag: string, state: TagState, pending: Proposal | null, now: bigint): string[] {
  const lines = [
    `tag        ${tag} (version ${state.version})`,
    `current    ${state.current}`,
    `previous   ${state.previous ?? "none (rollback not available)"}`,
    `timelock   ${formatDuration(state.minDelay)}`,
  ];
  if (pending) {
    lines.push(`PENDING    ${pending.wasmHash}`, `           ${describeEta(pending, now)}`);
  } else {
    lines.push("pending    none");
  }
  return lines;
}

export function formatHistory(records: VersionRecord[]): string[] {
  return records.map(
    (r) => `v${r.version}  ${r.kind.padEnd(8)}  ${formatTime(r.activatedAt)}  ${r.wasmHash}`,
  );
}

export function formatInstance(status: InstanceStatus): string {
  switch (status.mode) {
    case "following":
      return `${status.contractId}  following ${status.tag}  runs ${shortHash(status.wasmHash)}`;
    case "fixed":
      return `${status.contractId}  fixed (pinned)  runs ${shortHash(status.wasmHash)}`;
    case "stellar-asset":
      return `${status.contractId}  stellar asset contract`;
  }
}

export function formatFleet(report: FleetReport, now: bigint): string[] {
  return [
    `factory    ${report.factory}`,
    `spring     ${report.spring}`,
    `admin      ${report.admin}`,
    `guardian   ${report.guardian}`,
    ...formatTagState(report.tag, report.state, report.pending, now),
    "",
    `instances  ${report.instances.length} total, ${report.following} following, ${report.fixed} fixed`,
    ...report.instances.map((i) => `  ${formatInstance(i)}`),
  ];
}

/**
 * What an instance owner should know. For a following instance with a
 * pending proposal this is the call to action: pin before the eta or run
 * the new code.
 */
export function formatInstanceAdvice(
  status: InstanceStatus,
  pending: Proposal | null,
  now: bigint,
): string[] {
  if (status.mode !== "following") {
    return ["This contract runs its own fixed Wasm. Spring upgrades do not reach it."];
  }
  const lines = [
    `This contract's code is controlled by ${status.owner} (tag "${status.tag}").`,
    `It currently runs ${status.wasmHash}.`,
  ];
  if (!pending) {
    lines.push("No upgrade is pending.");
    return lines;
  }
  lines.push(
    `An upgrade to ${pending.wasmHash} is pending, ${describeEta(pending, now)}.`,
  );
  if (pending.eta > now) {
    lines.push("To stay on the current code, the instance owner must call pin() before then.");
  }
  return lines;
}

export function formatEvent(e: MainspringEvent): string {
  const at = `ledger ${e.ledger}  ${e.ledgerClosedAt}`;
  switch (e.name) {
    case "tag_created":
      return `${at}  tag_created        ${e.tag} -> ${shortHash(e.wasmHash)}, timelock ${formatDuration(e.minDelay)}`;
    case "upgrade_proposed":
      return `${at}  UPGRADE PROPOSED   ${e.tag} -> ${shortHash(e.wasmHash)}, eta ${formatTime(e.eta)}`;
    case "upgrade_executed":
      return `${at}  upgrade_executed   ${e.tag} v${e.version} -> ${shortHash(e.wasmHash)}`;
    case "upgrade_cancelled":
      return `${at}  upgrade_cancelled  ${e.tag} by ${e.by}`;
    case "rolled_back":
      return `${at}  ROLLED BACK        ${e.tag} v${e.version} -> ${shortHash(e.wasmHash)} by ${e.by}`;
    case "min_delay_increased":
      return `${at}  timelock raised    ${e.tag} to ${formatDuration(e.minDelay)}`;
    case "admin_transfer_started":
      return `${at}  admin transfer     ${e.current} -> ${e.pending} (pending acceptance)`;
    case "admin_transferred":
      return `${at}  admin changed      ${e.previous} -> ${e.admin}`;
    case "guardian_changed":
      return `${at}  guardian changed   ${e.previous} -> ${e.guardian}`;
    case "instance_deployed":
      return `${at}  instance deployed  #${e.index} ${e.instance} by ${e.deployer}`;
    case "attached":
      return `${at}  attached           ${e.contractId} to ${e.owner} "${e.tag}"`;
    case "pinned":
      return `${at}  pinned             ${e.contractId} at ${shortHash(e.wasmHash)}`;
  }
}

/** JSON with bigints as strings. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
}
