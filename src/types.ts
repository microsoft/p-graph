/**
 * A description of a node in p-graph
 */
export interface PGraphNode {
  /** The function that will be executed for this graph node */
  run: () => Promise<unknown>;

  /**
   * A priority to help the scheduler decide which tasks to pick when many are available to run.
   * Default value is zero
   */
  priority?: number;
}

/**
 * Defines the set of p-graph nodes, with each key in this map representing a unique identifier for the node
 */
export type PGraphNodeMap = Map<string, PGraphNode>;

/**
 * Describes a dependency between two nodes in the p-graph. For each tuple in the array, the first task must complete before the second one begins
 */
export type DependencyList = [string, string][];

/**
 * The optional arguments to pass to the run function
 */
export interface RunOptions {
  /** The maximum amount of promises that can be executing at the same time */
  maxConcurrency?: number;
}
