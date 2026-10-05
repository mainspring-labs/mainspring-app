import { contract } from "@stellar/stellar-sdk";

import { ContractError } from "./errors.js";
import { type Network, rpcServer } from "./network.js";
import { FACTORY_SPEC } from "./spec.js";

export interface Fleet {
  spring: string;
  tag: string;
}

/** Read-only client for a deployed factory contract. */
export class FactoryReader {
  private readonly client: contract.Client;

  constructor(
    readonly contractId: string,
    network: Network,
  ) {
    this.client = new contract.Client(new contract.Spec(FACTORY_SPEC), {
      contractId,
      networkPassphrase: network.networkPassphrase,
      rpcUrl: network.rpcUrl,
      allowHttp: network.allowHttp ?? false,
      server: rpcServer(network),
    });
  }

  async fleet(): Promise<Fleet> {
    const [spring, tag] = await this.call<[string, string]>("fleet", {});
    return { spring, tag };
  }

  async count(): Promise<number> {
    return this.call<number>("count", {});
  }

  async instance(index: number): Promise<string> {
    const raw = await this.call<contract.Result<string>>("instance", { index });
    if (raw.isErr()) {
      throw new ContractError("factory", "instance", raw.unwrapErr().message);
    }
    return raw.unwrap();
  }

  /** Every instance the factory deployed, in deploy order. One read per instance. */
  async instances(): Promise<string[]> {
    const count = await this.count();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(await this.instance(i));
    }
    return out;
  }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const method = (this.client as unknown as Record<string, unknown>)[fn];
    if (typeof method !== "function") {
      throw new Error(`factory spec has no function ${fn}`);
    }
    const tx = (await method.call(this.client, args)) as contract.AssembledTransaction<T>;
    return tx.result;
  }
}
