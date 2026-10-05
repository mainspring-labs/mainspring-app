import { FactoryReader } from "./factory.js";
import { followsTag, inspectInstance, type InstanceStatus } from "./instance.js";
import { type Network, rpcServer } from "./network.js";
import { type Proposal, SpringReader, type TagState } from "./spring.js";

export interface FleetReport {
  factory: string;
  spring: string;
  tag: string;
  state: TagState;
  pending: Proposal | null;
  admin: string;
  guardian: string;
  instances: InstanceStatus[];
  /** Instances that will run a proposal once it executes. */
  following: number;
  /** Instances that left the fleet and run their own fixed Wasm. */
  fixed: number;
}

/** Everything an operator or instance owner needs to know about one fleet. */
export async function fleetReport(factoryId: string, network: Network): Promise<FleetReport> {
  const factory = new FactoryReader(factoryId, network);
  const { spring: springId, tag } = await factory.fleet();
  const spring = new SpringReader(springId, network);
  const server = rpcServer(network);

  const [state, pending, admin, guardian, ids] = await Promise.all([
    spring.tag(tag),
    spring.pending(tag),
    spring.admin(),
    spring.guardian(),
    factory.instances(),
  ]);
  const instances = await Promise.all(ids.map((id) => inspectInstance(server, id)));
  const following = instances.filter((i) => followsTag(i, springId, tag)).length;

  return {
    factory: factoryId,
    spring: springId,
    tag,
    state,
    pending,
    admin,
    guardian,
    instances,
    following,
    fixed: instances.filter((i) => i.mode === "fixed").length,
  };
}
