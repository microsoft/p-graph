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

const hasCycleDFS = (graph: Map<string, PGraphNodeWithDependencies>, visitMap: Map<string, boolean>, nodeId: string): boolean => {
  if (visitMap.has(nodeId)) {
    /**
     * If the visitMap has `true` for this nodeId,
     * this means that this node has been visited before
     * in this current traversal, hence there is a cycle.
     */
    return Boolean(visitMap.get(nodeId));
  }

  const node = graph.get(nodeId);
  if (!node) {
    throw new Error(`Could not find node "${nodeId}" in the graph`);
  }

  /**
   * This node is going to be traversed
   */
  visitMap.set(nodeId, true);

  /**
   * Search for cycles in dependencies of this node
   */
  for (let dependencyId of node.dependsOn) {
    if (hasCycleDFS(graph, visitMap, dependencyId)) {
      return true;
    }
  }

  /**
   * This node has been traversed and has no cycles
   */
  visitMap.set(nodeId, false);
  return false;
};
