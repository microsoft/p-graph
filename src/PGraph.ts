import { RunOptions, PGraphNodeMap, DependencyList, PGraphNode } from "./types";

interface PGraphNodeWithDependencies extends PGraphNode {
  dependsOn: Set<string>;

  dependedOnBy: Set<string>;
}

export class PGraph {
  private readonly pGraphDependencyMap = new Map<string, PGraphNodeWithDependencies>();

  /**
   * Tracks all the nodes that are ready to be executed since it is not depending on the results of any non completed tasks.
   */
  private readonly nodesWithNoDependencies: string[];

  constructor(nodeMap: PGraphNodeMap, dependencies: DependencyList) {
    [...nodeMap.entries()].forEach(([key, node]) => {
      this.pGraphDependencyMap.set(key, { ...node, dependsOn: new Set(), dependedOnBy: new Set() });
    });

    dependencies.forEach(([subjectId, dependentId]) => {
      const subjectNode = this.pGraphDependencyMap.get(subjectId);
      const dependentNode = this.pGraphDependencyMap.get(dependentId);

      if (!subjectNode) {
        throw new Error(`Dependency graph referenced node with id ${subjectId}, which was not in the node list`);
      }

      if (!dependentNode) {
        throw new Error(`Dependency graph referenced node with id ${dependentId}, which was not in the node list`);
      }

      subjectNode.dependedOnBy.add(dependentId);
      dependentNode.dependsOn.add(subjectId);
    });

    this.nodesWithNoDependencies = getNodesWithNoDependencies(this.pGraphDependencyMap);

    if (graphHasCycles(this.pGraphDependencyMap, this.nodesWithNoDependencies)) {
      throw new Error("The dependency graph has a cycle in it");
    }
  }

  /**
   * Runs all the tasks in the promise graph in dependency order
   * @param options - An optional configuration for running the tasks
   */
  run(options?: RunOptions): Promise<void> {
    const maxConcurrency = options?.maxConcurrency;

    if (maxConcurrency !== undefined && maxConcurrency < 0) {
      throw new Error(`maxConcurrency must be either undefined or a positive integer, received ${options?.maxConcurrency}`);
    }

    let currentlyRunningTaskCount = 0;

    const scheduleTask = async () => {
      const taskToRunId = this.nodesWithNoDependencies.pop();

      if (!taskToRunId) {
        throw new Error("Tried to schedule a task when there were no pending tasks!");
      }
      const taskToRun = this.pGraphDependencyMap.get(taskToRunId)!;

      const taskFnPromise = taskToRun.run();
      currentlyRunningTaskCount += 1;

      await taskFnPromise;
      currentlyRunningTaskCount -= 1;

      // Let's remove this task from all dependent task's dependency array
      taskToRun.dependedOnBy.forEach((dependentId) => {
        const dependentNode = this.pGraphDependencyMap.get(dependentId)!;
        dependentNode.dependsOn.delete(taskToRunId);

        // If the task that just completed was the last remaining dependency for a node, add it to the set of unblocked nodes
        if (dependentNode.dependsOn.size === 0) {
          this.nodesWithNoDependencies.push(dependentId);
        }
      });
    };

    return new Promise((resolve, reject) => {
      const trySchedulingTasks = () => {
        if (this.nodesWithNoDependencies.length == 0 && currentlyRunningTaskCount === 0) {
          // We are done running all tasks, let's resolve the promise done
          resolve();
          return;
        }

        while (this.nodesWithNoDependencies.length > 0 && (maxConcurrency === undefined || currentlyRunningTaskCount < maxConcurrency)) {
          scheduleTask()
            .then(() => trySchedulingTasks())
            .catch((e) => reject(e));
        }
      };

      trySchedulingTasks();
    });
  }
}

/**
 * Given a pGraphDependency map, return the ids of all the nodes that do not have any dependencies.
 */
function getNodesWithNoDependencies(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>): string[] {
  const result: string[] = [];

  [...pGraphDependencyMap.entries()].forEach(([key, node]) => {
    if (node.dependsOn.size === 0) {
      result.push(key);
    }
  });

  return result;
}

function graphHasCycles(pGraphDependencyMap: Map<string, PGraphNodeWithDependencies>, nodesWithNoDependencies: string[]): boolean {
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
      if (checkForCyclesInternal(childId, visitedNodes)) {
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
