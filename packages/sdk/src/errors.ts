/** A call reached the contract and the contract returned an error. */
export class ContractError extends Error {
  constructor(
    readonly contract: "spring" | "factory",
    readonly fn: string,
    readonly detail: string,
  ) {
    super(`${contract}.${fn} failed: ${detail}`);
    this.name = "ContractError";
  }
}
