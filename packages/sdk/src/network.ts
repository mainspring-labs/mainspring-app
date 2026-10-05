import { Networks, rpc } from "@stellar/stellar-sdk";

export interface Network {
  rpcUrl: string;
  networkPassphrase: string;
  allowHttp?: boolean;
}

/** SDF's public testnet RPC. */
export const TESTNET: Network = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
};

/**
 * Mainnet needs an RPC URL from a provider: SDF does not run a public
 * mainnet RPC endpoint.
 */
export function mainnet(rpcUrl: string): Network {
  return { rpcUrl, networkPassphrase: Networks.PUBLIC };
}

export function rpcServer(network: Network): rpc.Server {
  return new rpc.Server(network.rpcUrl, {
    allowHttp: network.allowHttp ?? false,
  });
}
