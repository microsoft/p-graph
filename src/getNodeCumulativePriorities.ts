import { PGraphNodeWithDependencies } from "./types";
/**
 * Returns a JS map that has the "cumulative" priority for each node, which is defined as the priority of the current node plus the maximum cumulative priority amongst all children.
 * This is helpful for identifying which nodes to schedule first in order to get to higher priority nodes more quickly.
 */
export function getNodeCumulativePriorities(
  pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>,
  nodesWithNoDependencies: string[]
): Map<string, number> {
  const nodeCumulativePriorities = new Map<string, number>();

  const getNodeCumulativePrioritiesInternal = (currentNodeId: string): number => {
    const maybeComputedPriority = nodeCumulativePriorities.get(currentNodeId);
    if (maybeComputedPriority !== undefined) {
      return maybeComputedPriority;
    }

    const node = pGraphDependencyMap.get(currentNodeId)!;
    // The default priority for a node is zero
    const currentNodePriority = node.priority || 0;

    const maxChildCumulativePriority = Math.max(
      ...[...node.dependedOnBy.keys()].map((childId) => getNodeCumulativePrioritiesInternal(childId)),
      0
    );

    const result = currentNodePriority + maxChildCumulativePriority;
    nodeCumulativePriorities.set(currentNodeId, result);
    return result;
  };

  nodesWithNoDependencies.forEach((nodeId) => getNodeCumulativePrioritiesInternal(nodeId));

  return nodeCumulativePriorities;
}
