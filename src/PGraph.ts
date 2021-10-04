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
      this.pGraphDependencyMap.set(key, { ...node, dependsOn: new Set(), dependedOnBy: new Set(), failed: false });
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

    const graph = graphHasCycles(this.pGraphDependencyMap);

    if (graph.hasCycle) {
      throw new Error(`A cycle has been detected including the following nodes:\n${graph.cycle.join("\n")}`);
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

      try {
        currentlyRunningTaskCount += 1;

        if (!taskToRun.failed) {
          await taskToRun.run();
        }
      } catch(e) {
        // mark node and its children to be "failed" in the case of continue, we'll traverse, but not run the nodes
        taskToRun.failed = true;
        throw e;
      } finally {
        // schedule next round of tasks if options.continue (continue on error) or successfully run task
        const shouldScheduleMoreTasks = options?.continue || !taskToRun.failed;

        if (shouldScheduleMoreTasks) {
          // "currentlyRunningTaskCount" cannot be decremented on non-continue cases because of async nature of
          // the queue runner. The race condition will end up appearing as if there was no failures even though
          // there was one
          currentlyRunningTaskCount -= 1;

          // Let's remove this task from all dependent task's dependency array
          taskToRun.dependedOnBy.forEach((dependentId) => {
            const dependentNode = this.pGraphDependencyMap.get(dependentId)!;

            if (taskToRun.failed) {
              dependentNode.failed = true;
            }

            dependentNode.dependsOn.delete(taskToRunId);

            // If the task that just completed was the last remaining dependency for a node, add it to the set of unblocked nodes
            if (dependentNode.dependsOn.size === 0) {
              priorityQueue.insert(dependentId, nodeCumulativePriorities.get(dependentId)!);
            }
          });
        }
      }
    };

    return new Promise((resolve, reject) => {
      let errors: Error[] = [];

      const trySchedulingTasks = () => {
        if (priorityQueue.isEmpty() && currentlyRunningTaskCount === 0) {
          // We are done running all tasks, let's resolve the promise done
          if (errors.length === 0) {
            resolve();
          } else {
            reject(errors);
          }
          return;
        }

        while (!priorityQueue.isEmpty() && (concurrency === undefined || currentlyRunningTaskCount < concurrency)) {
          scheduleTask()
            .then(() => trySchedulingTasks())
            .catch((e) => {
              errors.push(e);

              // if a continue option is set, this merely records what errors have been encountered
              // it'll continue down the execution until all the tasks that still works
              if (options?.continue) {
                trySchedulingTasks();
              } else {
                // immediately reject, if not using "continue" option
                reject(e);
              }
            });
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
