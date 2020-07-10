import { FullDependencyMap, RunOptions, PGraphNodeMap } from "./types";

export class PGraph {
  // Map of promise name to it's function
  private promises: Map<string, Promise<unknown>> = new Map();

  constructor(private readonly nodeMap: PGraphNodeMap, private readonly dependencyGraph: FullDependencyMap) {
    this.promises = new Map();
  }

  /**
   * Runs the promise graph
   */
  run(options?: RunOptions) {
    return Promise.all([...this.dependencyGraph.keys()].map((name) => this.execute(name)));
  }

  private execute(name: string) {
    if (this.promises.has(name)) {
      return this.promises.get(name);
    }

    let execPromise: Promise<unknown> = Promise.resolve();

    const deps = this.dependencyGraph.get(name);

    if (deps) {
      execPromise = execPromise.then(() => Promise.all([...deps].map((depId) => this.execute(depId))));
    }

    execPromise = execPromise.then(() => this.nodeMap.get(name)?.run());

    this.promises.set(name, execPromise);

    return execPromise;
  }
}
