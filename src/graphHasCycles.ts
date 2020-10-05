import { PGraphNodeWithDependencies } from "./types";

/**
 * Checks for any cycles in the dependency graph, returning false if no cycles were detected.
 */
export function graphHasCycles(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>): boolean {
  /**
   *  A map to keep track of the visited and visiting nodes.
   * <node, true> entry means it is currently being visited.
   * <node, false> entry means it's sub graph has been visited and is a DAG.
   * No entry means the node has not been visited yet.
   */
  const visitMap = new Map<string, boolean>();

  for (const [nodeId] of pGraphDependencyMap.entries()) {
    /**
     * Test whether this node has already been visited or not.
     */
    if (!visitMap.has(nodeId)) {
      /**
       * Test whether the sub-graph of this node has cycles.
       */
      if (hasCycleDFS(pGraphDependencyMap, visitMap, nodeId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Stack element represents an item on the
 * stack used for depth-first search
 */
interface StackElement {
  /**
   * The node name
   */
  node: string;

  /**
   * This represents if this instance of the
   * node on the stack is being traversed or not
   */
  traversing: boolean;
}

const hasCycleDFS = (graph: Map<string, PGraphNodeWithDependencies>, visitMap: Map<string, boolean>, nodeId: string): boolean => {
  const stack: StackElement[] = [{ node: nodeId, traversing: false }];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (!current.traversing) {
      if (visitMap.has(current.node)) {
        if (visitMap.get(current.node)) {
          /**
           * The current node has already been visited,
           * hence there is a cycle.
           */
          return true;
        } else {
          /**
           * The current node has already been fully traversed
           */
          stack.pop();
          continue;
        }
      }

      /**
       * The current node is starting it's traversal
       */
      visitMap.set(current.node, true);
      stack[stack.length - 1] = { ...current, traversing: true };

      /**
       * Get the current node in the graph
       */
      const node = graph.get(current.node);
      if (!node) {
        throw new Error(`Could not find node "${current.node}" in the graph`);
      }

      /**
       * Add the current node's dependencies to the stack
       */
      stack.push(...[...node.dependsOn].map((n) => ({ node: n, traversing: false })));
    } else {
      /**
       * The current node has now been fully traversed.
       */
      visitMap.set(current.node, false);
      stack.pop();
    }
  }
  return false;
};
