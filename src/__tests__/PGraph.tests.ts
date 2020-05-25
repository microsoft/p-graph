import { PGraph } from "../PGraph";
import { NamedFunctions, DepGraphMap } from "../types";

describe("PGraph", () => {
  it("should allow a full graph to be created", async () => {
    const fns: NamedFunctions = new Map();
    const graph: DepGraphMap = new Map();

    const mockFn = jest.fn((id) => Promise.resolve());

    fns.set("fn1", mockFn);
    fns.set("fn2", mockFn);

    graph.set("fn1", new Set(["fn2"]));

    const pGraph = new PGraph(fns, graph);
    await pGraph.run();

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenNthCalledWith(1, "fn2");
    expect(mockFn).toHaveBeenNthCalledWith(2, "fn1");
  });

  it("should throw when one of the promises threw", async () => {
    const fns: NamedFunctions = new Map();
    const graph: DepGraphMap = new Map();

    const mockFn = jest.fn((id) => Promise.resolve());
    const failFn = jest.fn((id) => {
      throw new Error("expected failure");
    });

    fns.set("fn1", mockFn);
    fns.set("fn2", mockFn);
    fns.set("fail", failFn);

    graph.set("fn1", new Set(["fn2", "fail"]));

    const pGraph = new PGraph(fns, graph);
    await pGraph.run();
  });
});
