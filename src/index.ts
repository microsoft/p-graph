import { PGraph } from "./PGraph";
import type { PGraphNodeMap, DependencyList } from "./types";

export function pGraph(nodeMap: PGraphNodeMap, dependencies: DependencyList) {
  return new PGraph(nodeMap, dependencies);
}

export default pGraph;

export type * from "./types";
