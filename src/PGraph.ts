import { NamedFunctions, DepGraphMap, ScopeFunction, Id } from "./types";

export class PGraph {
  private promises: Map<Id, Promise<unknown>> = new Map();

  namedFunctions: NamedFunctions;
  graph: DepGraphMap;

  constructor(namedFunctions, graph: DepGraphMap) {
    this.namedFunctions = namedFunctions;
    this.graph = graph;

    this.promises = new Map();
  }

  /**
   * Runs the promise graph with scoping
   * @param scope
   */
  run(scope?: ScopeFunction) {
    const scopedPromises = scope
      ? scope(this.graph).map((id) => this.execute(id))
      : [...this.graph.keys()].map((id) => this.execute(id));

    return Promise.all(scopedPromises);
  }

  private execute(id: Id) {
    if (this.promises.has(id)) {
      return this.promises.get(id);
    }

    let execPromise: Promise<unknown> = Promise.resolve();

    const deps = this.graph.get(id);

    if (deps) {
      execPromise = execPromise.then(() =>
        Promise.all([...deps].map((depId) => this.execute(depId)))
      );
    }

    execPromise = execPromise.then(() => this.namedFunctions.get(id)(id));

    this.promises.set(id, execPromise);

    return execPromise;
  }
}
