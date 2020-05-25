export type RunFunction = (id: Id) => Promise<unknown>;
export type Id = string | number | RunFunction;
export type NamedFunctions = Map<Id, RunFunction>;
export type DepGraphMap = Map<Id, Set<Id>>;
export type ScopeFunction = (graph: DepGraphMap) => Id[];
export type DepGraphArray = [Id, Id][];
