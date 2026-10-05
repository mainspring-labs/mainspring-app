import { Address, type rpc } from "@stellar/stellar-sdk";

import { toHex } from "./bytes.js";

/**
 * How a contract gets its code.
 *
 * - `following`: runs whatever Wasm `owner` stores under `tag`. The owner
 *   can change this contract's code.
 * - `fixed`: runs one Wasm hash of its own. A pinned fleet instance looks
 *   like this, as does any contract that never joined a fleet.
 * - `stellar-asset`: a built-in Stellar Asset Contract.
 */
export type InstanceStatus =
  | {
      mode: "following";
      contractId: string;
      owner: string;
      tag: string;
      /** The Wasm hash the reference currently resolves to. */
      wasmHash: string;
    }
  | { mode: "fixed"; contractId: string; wasmHash: string }
  | { mode: "stellar-asset"; contractId: string };

type Executable = Awaited<ReturnType<rpc.Server["getContractInstance"]>>["executable"];

/** Look up how `contractId` gets its code, resolving a CAP-85 reference. */
export async function inspectInstance(
  server: rpc.Server,
  contractId: string,
): Promise<InstanceStatus> {
  const instance = await server.getContractInstance(contractId);
  const executable: Executable = instance.executable;
  switch (executable.type) {
    case "contractExecutableWasm":
      return { mode: "fixed", contractId, wasmHash: executable.wasmHash.toString() };
    case "contractExecutableStellarAsset":
      return { mode: "stellar-asset", contractId };
    case "contractExecutableExternalRef": {
      const ref = executable.externalRef;
      const wasmHash = await server.getExternalRefWasmHash(ref);
      return {
        mode: "following",
        contractId,
        owner: Address.fromScAddress(ref.executableOwner).toString(),
        tag: ref.tag.toString(),
        wasmHash: toHex(wasmHash),
      };
    }
  }
}

/** True when `status` runs from `spring`'s `tag`. */
export function followsTag(status: InstanceStatus, spring: string, tag: string): boolean {
  return status.mode === "following" && status.owner === spring && status.tag === tag;
}
