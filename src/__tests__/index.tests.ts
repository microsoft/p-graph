import pGraph from "../index";
import { PGraphNodeMap, PGraphNode, DependencyList } from "../types";

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

function defineMockNode(definition: MockFunctionDefinition, functionScheduler: FunctionScheduler): [string, PGraphNode] {
  return [definition.name, { run: () => functionScheduler.startExecutingFunction(definition) }];
}

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Enforces that a particular schedule does not schedule secondTaskName until firstTaskName is complete
       */
      toHaveScheduleOrdering(firstTaskName: string, secondTaskName: string): R;
    }
  }
}

expect.extend({
  toHaveScheduleOrdering(callRecords: MockFunctionCallRecord[], firstTaskName: string, secondTaskName: string) {
    const firstIndex = callRecords.findIndex((item) => item.name === firstTaskName && item.state === "end");
    const secondIndex = callRecords.findIndex((item) => item.name === secondTaskName && item.state === "start");

    const pass = firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;

    return {
      message: () => `expected ${secondTaskName} to be scheduled after ${firstTaskName}`,
      pass,
    };
  },
});

const computeMaxConcurrency = (callRecords: MockFunctionCallRecord[]) => {
  let currentConcurrency = 0;
  let maxConcurrencySoFar = 0;

  callRecords.forEach((record) => {
    currentConcurrency += record.state === "start" ? 1 : -1;
    maxConcurrencySoFar = Math.max(currentConcurrency, maxConcurrencySoFar);
  });

  return maxConcurrencySoFar;
};

describe("Public API", () => {
  it("should accept the dependency graph and execute tasks in order", async () => {
    const functionScheduler = new FunctionScheduler();

    const nodeMap: PGraphNodeMap = new Map([
      defineMockNode({ name: "putOnShirt", duration: 1 }, functionScheduler),
      defineMockNode({ name: "putOnShorts", duration: 1 }, functionScheduler),
      defineMockNode({ name: "putOnJacket", duration: 1 }, functionScheduler),
      defineMockNode({ name: "putOnShoes", duration: 1 }, functionScheduler),
      defineMockNode({ name: "tieShoes", duration: 1 }, functionScheduler),
    ]);

    const dependencies: DependencyList = [
      ["putOnShoes", "tieShoes"],
      ["putOnShirt", "putOnJacket"],
      ["putOnShorts", "putOnJacket"],
      ["putOnShorts", "putOnShoes"],
    ];

    await pGraph(nodeMap, dependencies).run();

    const { callRecords } = functionScheduler;
    expect(callRecords).toHaveScheduleOrdering("putOnShoes", "tieShoes");
    expect(callRecords).toHaveScheduleOrdering("putOnShirt", "putOnJacket");
    expect(callRecords).toHaveScheduleOrdering("putOnShorts", "putOnJacket");
    expect(callRecords).toHaveScheduleOrdering("putOnShorts", "putOnShoes");
  });

  it("throws an exception when run is invoked and a task rejects its promise", async () => {
    const nodeMap: PGraphNodeMap = new Map([
      ["A", { run: () => Promise.resolve() }],
      ["B", { run: () => Promise.resolve() }],
      ["C", { run: () => Promise.reject("C rejected") }],
    ]);

    const dependencies: DependencyList = [
      ["B", "A"],
      ["C", "A"],
    ];

    await expect(pGraph(nodeMap, dependencies).run()).rejects.toEqual("C rejected");
  });

  it("should be able to run more than one task at a time", async () => {
    const functionScheduler = new FunctionScheduler();

    const nodeMap: PGraphNodeMap = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 1 }, functionScheduler),
      defineMockNode({ name: "C", duration: 1 }, functionScheduler),
    ]);

    //  A
    // B C
    const dependencies: DependencyList = [
      ["B", "A"],
      ["C", "A"],
    ];

    await pGraph(nodeMap, dependencies).run();

    // B and C should run concurrently
    expect(computeMaxConcurrency(functionScheduler.callRecords)).toEqual(2);
  });

  it("should not exceed maximum concurrency", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 1 }, functionScheduler),
      defineMockNode({ name: "C", duration: 1 }, functionScheduler),
      defineMockNode({ name: "D", duration: 1 }, functionScheduler),
      defineMockNode({ name: "E", duration: 1 }, functionScheduler),
    ]);

    //    A
    // B C D E
    const dependencies: DependencyList = [
      ["B", "A"],
      ["C", "A"],
      ["D", "A"],
      ["E", "A"],
    ];

    await pGraph(funcs, dependencies).run({ maxConcurrency: 3 });

    // B and C should run concurrently
    expect(computeMaxConcurrency(functionScheduler.callRecords)).toBeLessThanOrEqual(3);
  });
});
