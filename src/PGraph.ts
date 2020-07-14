import { RunOptions, PGraphNodeMap, DependencyList, PGraphNodeWithDependencies } from "./types";
import { PriorityQueue } from "./PriorityQueue";
import { getNodeCumulativePriorities } from "./getNodeCumulativePriorities";
import { graphHasCycles } from "./graphHasCycles";
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

    if (this.nodesWithNoDependencies.length == 0 && nodeMap.size > 0) {
      throw new Error("We could not find a node in the graph with no dependencies, this likely means there is a cycle including all nodes");
    }

    if (graphHasCycles(this.pGraphDependencyMap, this.nodesWithNoDependencies)) {
      throw new Error("The dependency graph has a cycle in it");
    }
  }

  /**
   * Runs all the tasks in the promise graph in dependency order
   * @param options - An optional configuration for running the tasks
   */
  run(options?: RunOptions): Promise<void> {
    const concurrency = options?.concurrency;

    if (concurrency !== undefined && concurrency < 0) {
      throw new Error(`concurrency must be either undefined or a positive integer, received ${options?.concurrency}`);
    }

    const nodeCumulativePriorities = getNodeCumulativePriorities(this.pGraphDependencyMap, this.nodesWithNoDependencies);
    const priorityQueue = new PriorityQueue<string>();

    this.nodesWithNoDependencies.forEach((itemId) => priorityQueue.insert(itemId, nodeCumulativePriorities.get(itemId)!));

    let currentlyRunningTaskCount = 0;

    const scheduleTask = async () => {
      const taskToRunId = priorityQueue.removeMax();

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
          priorityQueue.insert(dependentId, nodeCumulativePriorities.get(dependentId)!);
        }
      });
    };

    return new Promise((resolve, reject) => {
      const trySchedulingTasks = () => {
        if (priorityQueue.isEmpty() && currentlyRunningTaskCount === 0) {
          // We are done running all tasks, let's resolve the promise done
          resolve();
          return;
        }

        while (!priorityQueue.isEmpty() && (concurrency === undefined || currentlyRunningTaskCount < concurrency)) {
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
