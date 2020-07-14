import { PGraphNodeWithDependencies } from "./types";

/** Creates a map of node ids to a set of all the nodes this node depends on. This creates a new copy of the set to enable duplication */
function getNewDependsOnMap(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>): Map<string, Set<string>> {
  return new Map([...pGraphDependencyMap.entries()].map(([key, value]) => [key, new Set(value.dependsOn)]));
}

function topologicalSort(
  pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>,
  nodesWithNoDependencies: readonly string[]
): string[] {
  const sortedList: string[] = [];

  const dependsOnMap = getNewDependsOnMap(pGraphDependencyMap);
  const nodesWithNoDependenciesClone = [...nodesWithNoDependencies];

  while (nodesWithNoDependenciesClone.length > 0) {
    const currentId = nodesWithNoDependenciesClone.pop()!;

    sortedList.push(currentId);

    const node = pGraphDependencyMap.get(currentId)!;

    // Update the depends on maps of all outgoing edges
    node.dependedOnBy.forEach((childId) => {
      const childNode = dependsOnMap.get(childId)!;
      childNode.delete(currentId);

      // If this item is now unblocked, put it on the unblocked list
      if (childNode.size === 0) {
        nodesWithNoDependenciesClone.push(childId);
      }
    });
  }

  return sortedList;
}

/**
 * Returns a JS map that has the "cumulative" priority for each node, which is defined as the priority of the current node plus the maximum cumulative priority amongst all children.
 * This is helpful for identifying which nodes to schedule first in order to get to higher priority nodes more quickly.
 */
export function getNodeCumulativePriorities(
  pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>,
  nodesWithNoDependencies: string[]
): Map<string, number> {
  const nodeCumulativePriorities = new Map<string, number>();

  const stack = topologicalSort(pGraphDependencyMap, nodesWithNoDependencies);

  while (stack.length > 0) {
    const currentNodeId = stack.pop()!;
    const node = pGraphDependencyMap.get(currentNodeId)!;
    // The default priority for a node is zero
    const currentNodePriority = node.priority || 0;

    const maxChildCumulativePriority = Math.max(
      ...[...node.dependedOnBy.keys()].map((childId) => {
        const childCumulativePriority = nodeCumulativePriorities.get(childId);
        if (childCumulativePriority === undefined) {
          throw new Error(`Expected to have already computed the cumulative priority for node ${childId}`);
        }

        return childCumulativePriority;
      }),
      0
    );

    const result = currentNodePriority + maxChildCumulativePriority;
    nodeCumulativePriorities.set(currentNodeId, result);
  }

  return nodeCumulativePriorities;
}
