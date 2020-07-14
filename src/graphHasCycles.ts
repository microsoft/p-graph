import { PGraphNodeWithDependencies } from "./types";

/**
 * Checks for any cycles in the dependency graph, returning false if no cycles were detected.
 */
export function graphHasCycles(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>, nodesWithNoDependencies: string[]): boolean {
  const stack: { nodeId: string; visitedNodes: Set<string> }[] = [];
  nodesWithNoDependencies.forEach((root) => stack.push({ nodeId: root, visitedNodes: new Set() }));

  while (stack.length > 0) {
    const { nodeId, visitedNodes } = stack.pop()!;

    // If we have already seen this node, we've found a cycle
    if (visitedNodes.has(nodeId)) {
      return true;
    }

    visitedNodes.add(nodeId);

    const node = pGraphDependencyMap.get(nodeId)!;

    [...node.dependedOnBy.keys()].forEach((childId) => stack.push({ nodeId: childId, visitedNodes: new Set(visitedNodes) }));
  }

  return false;
}
