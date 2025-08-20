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
 * Describes a dependency between two nodes in the p-graph.
 * For each tuple in the array, the first task must complete before the second one begins.
 */
export type DependencyList = [string, string][];

/**
 * The optional arguments to pass to the run function
 */
export interface RunOptions {
  /**
   * The maximum amount of promises that can be executing at the same time.
   * When not provided, we do not limit the number of concurrent tasks and run tasks
   * as soon as they are unblocked.
   */
  concurrency?: number;

  /** Continues the graph even if there's an rejected task */
  continue?: boolean;
}

/**
 * An internally used representation of the dependency graph nodes that includes all nodes that
 * this node depends on plus all the nodes that depend on this node.
 */
export interface PGraphNodeWithDependencies extends PGraphNode {
  /**
   * The set of nodes that this node depends on. This node should not be executed until all the
   * nodes in this list have been executed to completion.
   */
  dependsOn: Set<string>;

  /**
   * The set of nodes that cannot start execution until this node has completed execution.
   */
  dependedOnBy: Set<string>;

  /**
   * Flag whether this node is failed or not (if so, skip it and mark its children to be skipped)
   */
  failed: boolean;
}

export interface PGraphNodeWithNoCyclicDependency {
  /**
   * Flag whether there is no cyclic dependency
   */
  hasCycle: false;
}

export interface PGraphNodeWithCyclicDependency {
  /**
   * Flag whether there is a cyclic dependency
   */
  hasCycle: true;
  /**
   * Chain of node where the cyclic dependency was detected.
   */
  cycle: string[];
}
