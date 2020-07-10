import { PGraph } from "./PGraph";
import { PGraphNodeMap, DependencyList } from "./types";
import { depArrayToMap } from "./depConverters";

function pGraph(nodeMap: PGraphNodeMap, dependencies: DependencyList) {
  return new PGraph(nodeMap, depArrayToMap(dependencies));
}

export default pGraph;
