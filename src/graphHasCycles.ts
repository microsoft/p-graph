import { PGraphNodeWithDependencies } from "./types";

/**
 * Checks for any cycles in the dependency graph, returning false if no cycles were detected.
 */
export function graphHasCycles(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>, nodesWithNoDependencies: string[]): boolean {
  const checkForCyclesInternal = (currentNodeId: string, visitedNodes: Set<string>): boolean => {
    // If we have already seen this node, we've found a cycle
    if (visitedNodes.has(currentNodeId)) {
      return true;
    }

    visitedNodes.add(currentNodeId);

    const node = pGraphDependencyMap.get(currentNodeId)!;

    // If we got to a leaf node, this particular path does not have a cycle
    if (node.dependedOnBy.size === 0) {
      return false;
    }

    for (const childId of node.dependedOnBy.keys()) {
      if (checkForCyclesInternal(childId, new Set(visitedNodes))) {
        return true;
      }
    }

    return false;
  };

  for (const root of nodesWithNoDependencies) {
    if (checkForCyclesInternal(root, new Set())) {
      return true;
    }
  }

  return false;
}
