import { FullDependencyMap, DependencyList } from "./types";

export function depArrayToMap(dependencies: DependencyList): FullDependencyMap {
  const graph: FullDependencyMap = new Map();

  // dependant depends on subject (Child depends on Parent means Child is dependent, Parent is subject)
  for (const [subjectId, dependentId] of dependencies) {
    if (!graph.has(dependentId)) {
      graph.set(dependentId, new Set([subjectId]));
    } else {
      graph.get(dependentId).add(subjectId);
    }
  }
  return graph;
}
