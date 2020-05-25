import {
  DepGraphArray,
  NamedFunctions,
  DepGraphMap,
  RunFunction,
} from "./types";

export function depArrayToNamedFunctions(array: DepGraphArray) {
  const namedFunctions: NamedFunctions = new Map();

  // dependant depends on subject (Child depends on Parent means Child is dependent, Parent is subject)
  for (const [subject, dependent] of array) {
    namedFunctions.set(subject, subject as RunFunction);
    namedFunctions.set(dependent, dependent as RunFunction);
  }
  return namedFunctions;
}

export function depArrayToMap(array: DepGraphArray) {
  const graph: DepGraphMap = new Map();

  // dependant depends on subject (Child depends on Parent means Child is dependent, Parent is subject)
  for (const [subjectId, dependentId] of array) {
    if (!graph.has(dependentId)) {
      graph.set(dependentId, new Set([subjectId]));
    } else {
      graph.get(dependentId).add(subjectId);
    }
  }
  return graph;
}
