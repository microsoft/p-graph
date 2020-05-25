import { DepGraphArray, NamedFunctions, DepGraphMap } from "./types";
import { PGraph } from "./PGraph";
import { depArrayToNamedFunctions, depArrayToMap } from "./depConverters";

function pGraph(namedFunctions: NamedFunctions, graph: DepGraphMap);
function pGraph(namedFunctions: NamedFunctions, graph: DepGraphArray);
function pGraph(graph: DepGraphArray);

function pGraph(...args: any[]) {
  if (args.length < 1 || args.length > 2) {
    throw new Error("Incorrect number of arguments");
  }

  let namedFunctions: NamedFunctions;
  let graph: DepGraphMap;

  if (args.length === 1) {
    if (!Array.isArray(args[0])) {
      throw new Error(
        "Unexpected graph definition format. Expecting graph in the form of [()=>Promise, ()=>Promise][]"
      );
    }

    const depArray = args[0] as DepGraphArray;
    namedFunctions = depArrayToNamedFunctions(depArray);
    graph = depArrayToMap(depArray);
  } else if (args.length === 2) {
    if (Array.isArray(args[0])) {
      const depArray = args[0] as DepGraphArray;
      namedFunctions = depArrayToNamedFunctions(depArray);
      graph = depArrayToMap(depArray);
    } else if (args[0] instanceof Map && Array.isArray(args[1])) {
      const depArray = args[1] as DepGraphArray;
      namedFunctions = args[0];
      graph = depArrayToMap(depArray);
    } else if (args[0] instanceof Map && args[1] instanceof Map) {
      namedFunctions = args[0];
      graph = args[1];
    } else {
      throw new Error("Unexpected arguments");
    }
  }

  return new PGraph(namedFunctions, graph);
}

export default pGraph;
