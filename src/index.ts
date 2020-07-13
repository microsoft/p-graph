import { PGraph } from "./PGraph";
import { PGraphNodeMap, DependencyList } from "./types";

function pGraph(nodeMap: PGraphNodeMap, dependencies: DependencyList) {
  return new PGraph(nodeMap, dependencies);
}

export default pGraph;
