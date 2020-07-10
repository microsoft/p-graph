import pGraph from "../index";
import { DepGraphArray } from "../types";

interface MockFunctionDefinition {
  /** A friendly name for the function */
  name: string;

  /** How many ticks this function should take to simulate the duration of the function execution */
  duration: number;
}

/** A record of a function start or end event that can be composed to create an ordered log of function calls **/
interface MockFunctionCallRecord {
  /** The name of the function */
  name: string;

  /** Denotes if this is when the function started or ended execution */
  state: "start" | "end";
}

class FunctionScheduler {
  private currentlyRunningFunctions: { name: string; ticksRemaining: number; resolve: () => void }[] = [];

  private tickScheduled: boolean = false;

  public callRecords: MockFunctionCallRecord[] = [];

  public startExecutingFunction(definition: MockFunctionDefinition): Promise<unknown> {
    const { name, duration } = definition;
    this.callRecords.push({ name, state: "start" });

    const promise = new Promise((resolve) => {
      this.currentlyRunningFunctions.push({ name, ticksRemaining: duration, resolve });
    });

    this.ensureTickScheduled();

    return promise;
  }

  private ensureTickScheduled() {
    if (!this.tickScheduled) {
      Promise.resolve().then(() => this.tick());
      this.tickScheduled = true;
    }
  }

  private tick() {
    this.tickScheduled = false;
    this.currentlyRunningFunctions.forEach((item) => {
      item.ticksRemaining = item.ticksRemaining - 1;
    });

    const remainingItems = this.currentlyRunningFunctions.filter((item) => item.ticksRemaining === 0);

    if (remainingItems.length > 0) {
      remainingItems.forEach((item) => {
        item.resolve();
        this.callRecords.push({ name: item.name, state: "end" });
      });
      this.ensureTickScheduled();
    }
  }
}

function defineMockFunction(definition: MockFunctionDefinition, functionScheduler: FunctionScheduler): () => Promise<unknown> {
  return () => functionScheduler.startExecutingFunction(definition);
}

const expectScheduledBefore = (callRecords: MockFunctionCallRecord[], firstTaskName: string, secondTaskName: string) => {
  const firstIndex = callRecords.findIndex((item) => item.name === firstTaskName && item.state === "end");
  const secondIndex = callRecords.findIndex((item) => item.name === secondTaskName && item.state === "start");

  expect(firstIndex).not.toEqual(-1);
  expect(secondIndex).not.toEqual(-1);
  expect(secondIndex).toBeGreaterThan(firstIndex);
};

const computeMaxConcurrency = (callRecords: MockFunctionCallRecord[]) => {
  let currentConcurrency = 0;
  let maxConcurrencySoFar = 0;

  callRecords.forEach((record) => {
    currentConcurrency += record.state === "start" ? 1 : -1;
    maxConcurrencySoFar = Math.max(currentConcurrency, maxConcurrencySoFar);
  });

  return maxConcurrencySoFar;
};

const gettingDressedTestFunctions = () => {
  const functionScheduler = new FunctionScheduler();

  return {
    callRecords: functionScheduler.callRecords,
    // Example graph from: https://www.npmjs.com/package/toposort
    putOnShirt: defineMockFunction({ name: "putOnShirt", duration: 1 }, functionScheduler),
    putOnShorts: defineMockFunction({ name: "putOnShorts", duration: 1 }, functionScheduler),
    putOnJacket: defineMockFunction({ name: "putOnJacket", duration: 1 }, functionScheduler),
    putOnShoes: defineMockFunction({ name: "putOnShoes", duration: 1 }, functionScheduler),
    tieShoes: defineMockFunction({ name: "tieShoes", duration: 1 }, functionScheduler),
  };
};

const ensureValidGettingDressedOrder = (callRecords: MockFunctionCallRecord[]) => {
  expectScheduledBefore(callRecords, "putOnShoes", "tieShoes");
  expectScheduledBefore(callRecords, "putOnShirt", "putOnJacket");
  expectScheduledBefore(callRecords, "putOnShorts", "putOnJacket");
  expectScheduledBefore(callRecords, "putOnShorts", "putOnShoes");
};

describe("Public API", () => {
  it("should accept an array dep graph", async () => {
    const { callRecords, putOnJacket, putOnShirt, putOnShoes, putOnShorts, tieShoes } = gettingDressedTestFunctions();

    const graph: DepGraphArray = [
      [putOnShoes, tieShoes],
      [putOnShirt, putOnJacket],
      [putOnShorts, putOnJacket],
      [putOnShorts, putOnShoes],
    ];

    await pGraph(graph).run();

    ensureValidGettingDressedOrder(callRecords);
  });

  it("should accept a dependency array with a list of named functions", async () => {
    // This is intentionally not destructuring to make sure we don't accidentally forget the quotes for function naming
    const testFunctions = gettingDressedTestFunctions();

    const funcs = new Map();

    funcs.set("putOnShirt", testFunctions.putOnShirt);
    funcs.set("putOnShorts", testFunctions.putOnShorts);
    funcs.set("putOnJacket", testFunctions.putOnJacket);
    funcs.set("putOnShoes", testFunctions.putOnShoes);
    funcs.set("tieShoes", testFunctions.tieShoes);

    const graph: DepGraphArray = [
      ["putOnShoes", "tieShoes"],
      ["putOnShirt", "putOnJacket"],
      ["putOnShorts", "putOnJacket"],
      ["putOnShorts", "putOnShoes"],
    ];

    await pGraph(funcs, graph).run();

    ensureValidGettingDressedOrder(testFunctions.callRecords);
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

    await pGraph(funcs, depMap).run();

    ensureValidGettingDressedOrder(testFunctions.callRecords);
  });

  it("should be able to run more than one task at a time", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map();

    funcs.set("A", defineMockFunction({ name: "A", duration: 1 }, functionScheduler));
    funcs.set("B", defineMockFunction({ name: "B", duration: 1 }, functionScheduler));
    funcs.set("C", defineMockFunction({ name: "C", duration: 1 }, functionScheduler));

    //  A
    // B C
    const graph: DepGraphArray = [
      ["B", "A"],
      ["C", "A"],
    ];

    await pGraph(funcs, graph).run();

    // B and C should run concurrently
    expect(computeMaxConcurrency(functionScheduler.callRecords)).toEqual(2);
  });

  it("should not exceed maximum concurrency", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map();

    funcs.set("A", defineMockFunction({ name: "A", duration: 1 }, functionScheduler));
    funcs.set("B", defineMockFunction({ name: "B", duration: 1 }, functionScheduler));
    funcs.set("C", defineMockFunction({ name: "C", duration: 1 }, functionScheduler));
    funcs.set("D", defineMockFunction({ name: "D", duration: 1 }, functionScheduler));
    funcs.set("E", defineMockFunction({ name: "E", duration: 1 }, functionScheduler));

    //    A
    // B C D E
    const graph: DepGraphArray = [
      ["B", "A"],
      ["C", "A"],
      ["D", "A"],
      ["E", "A"],
    ];

    await pGraph(funcs, graph).run({ concurrency: 3 });

    // B and C should run concurrently
    expect(computeMaxConcurrency(functionScheduler.callRecords)).toBeLessThanOrEqual(3);
  });
});
