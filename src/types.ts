export type RunFunction = (id: Id) => Promise<unknown>;
export type Id = string | number | RunFunction;
export type NamedFunctions = Map<Id, RunFunction>;
export type DepGraphMap = Map<Id, Set<Id>>;
export type DepGraphArray = [Id, Id][];

export interface RunOptions {
  /** The maximum amount of promises that can be executing at the same time */
  concurrency: number;
}
