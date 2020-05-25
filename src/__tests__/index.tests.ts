import pGraph from "../index";
import { DepGraphArray } from "../types";

describe("Public API", () => {
  let calls = [];

  // Example graph from: https://www.npmjs.com/package/toposort
  const putOnShirt = () =>
    Promise.resolve("put on your shirt").then((v) => {
      calls.push(v);
    });
  const putOnShorts = () =>
    Promise.resolve("put on your shorts").then((v) => {
      calls.push(v);
    });
  const putOnJacket = () =>
    Promise.resolve("put on your jacket").then((v) => {
      calls.push(v);
    });
  const putOnShoes = () =>
    Promise.resolve("put on your shoes").then((v) => {
      calls.push(v);
    });
  const tieShoes = () =>
    Promise.resolve("tie your shoes").then((v) => {
      calls.push(v);
    });

  beforeEach(() => {
    calls = [];
  });

  it("should accept an array dep graph", async () => {
    const graph: DepGraphArray = [
      [putOnShoes, tieShoes],
      [putOnShirt, putOnJacket],
      [putOnShorts, putOnJacket],
      [putOnShorts, putOnShoes],
    ];

    await pGraph(graph).run();

    expect(calls).toEqual([
      "put on your shirt",
      "put on your shorts",
      "put on your jacket",
      "put on your shoes",
      "tie your shoes",
    ]);
  });

  it("should accept an array dep graph", async () => {
    const graph: DepGraphArray = [
      [putOnShoes, tieShoes],
      [putOnShirt, putOnJacket],
      [putOnShorts, putOnJacket],
      [putOnShorts, putOnShoes],
    ];

    await pGraph(graph).run();

    expect(calls.indexOf("tie your shoes")).toBeGreaterThan(
      calls.indexOf("put on your shoes")
    );

    expect(calls.indexOf("put on your jacket")).toBeGreaterThan(
      calls.indexOf("put on your shirt")
    );

    expect(calls.indexOf("put on your jacket")).toBeGreaterThan(
      calls.indexOf("put on your shorts")
    );

    expect(calls.indexOf("put on your shoes")).toBeGreaterThan(
      calls.indexOf("put on your shorts")
    );
  });
});
