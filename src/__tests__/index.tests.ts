import pGraph from "../index";
import { DepGraphArray } from "../types";

const gettingDressedTestFunctions = () => {
  const calls = [];

  return {
    calls,
    // Example graph from: https://www.npmjs.com/package/toposort
    putOnShirt: () =>
      Promise.resolve("put on your shirt").then((v) => {
        calls.push(v);
      }),
    putOnShorts: () =>
      Promise.resolve("put on your shorts").then((v) => {
        calls.push(v);
      }),
    putOnJacket: () =>
      Promise.resolve("put on your jacket").then((v) => {
        calls.push(v);
      }),
    putOnShoes: () =>
      Promise.resolve("put on your shoes").then((v) => {
        calls.push(v);
      }),
    tieShoes: () =>
      Promise.resolve("tie your shoes").then((v) => {
        calls.push(v);
      }),
  };
};

const ensureValidGettingDressedOrder = (calls: string[]) => {
  expect(calls.indexOf("tie your shoes")).toBeGreaterThan(calls.indexOf("put on your shoes"));

  expect(calls.indexOf("put on your jacket")).toBeGreaterThan(calls.indexOf("put on your shirt"));

  expect(calls.indexOf("put on your jacket")).toBeGreaterThan(calls.indexOf("put on your shorts"));

  expect(calls.indexOf("put on your shoes")).toBeGreaterThan(calls.indexOf("put on your shorts"));
};

describe("Public API", () => {
  it("should accept an array dep graph", async () => {
    const { calls, putOnJacket, putOnShirt, putOnShoes, putOnShorts, tieShoes } = gettingDressedTestFunctions();

    const graph: DepGraphArray = [
      [putOnShoes, tieShoes],
      [putOnShirt, putOnJacket],
      [putOnShorts, putOnJacket],
      [putOnShorts, putOnShoes],
    ];

    await pGraph(graph).run();

    ensureValidGettingDressedOrder(calls);
  });

  it("should accept an array dep graph", async () => {
    const { calls, putOnJacket, putOnShirt, putOnShoes, putOnShorts, tieShoes } = gettingDressedTestFunctions();

    const graph: DepGraphArray = [
      [putOnShoes, tieShoes],
      [putOnShirt, putOnJacket],
      [putOnShorts, putOnJacket],
      [putOnShorts, putOnShoes],
    ];

    await pGraph(graph).run();

    ensureValidGettingDressedOrder(calls);
  });

  it("should accept a dependency map with a list of named functions", async () => {
    // This is intentionally not destructuring to make sure we don't accidentally forget the quotes for function naming
    const testFunctions = gettingDressedTestFunctions();

    const funcs = new Map();

    funcs.set("putOnShirt", testFunctions.putOnShirt);
    funcs.set("putOnShorts", testFunctions.putOnShorts);
    funcs.set("putOnJacket", testFunctions.putOnJacket);
    funcs.set("putOnShoes", testFunctions.putOnShoes);
    funcs.set("tieShoes", testFunctions.tieShoes);

    const depMap = new Map();

    depMap.set("tieShoes", new Set(["putOnShoes"]));
    depMap.set("putOnJacket", new Set(["putOnShirt", "putOnShorts"]));
    depMap.set("putOnShoes", new Set(["putOnShorts"]));
    depMap.set("putOnShorts", new Set());
    depMap.set("putOnShirt", new Set());

    ensureValidGettingDressedOrder(testFunctions.calls);
  });
});
