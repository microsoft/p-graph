import pGraph from "../index";
import { PGraphNodeMap, PGraphNode, DependencyList } from "../types";

interface MockFunctionDefinition {
  /** A friendly name for the function */
  name: string;

  /** How many ticks this function should take to simulate the duration of the function execution */
  duration: number;

  /** Priority value to pass to the PGraphNode that is crated */
  priority?: number;
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

    const finishedItems = this.currentlyRunningFunctions.filter((item) => item.ticksRemaining === 0);
    this.currentlyRunningFunctions = this.currentlyRunningFunctions.filter((item) => item.ticksRemaining !== 0);

    if (finishedItems.length > 0) {
      finishedItems.forEach((item) => {
        item.resolve();
        this.callRecords.push({ name: item.name, state: "end" });
      });
    }

    if (this.currentlyRunningFunctions.length > 0) {
      this.ensureTickScheduled();
    }
  }
}

function defineMockNode(definition: MockFunctionDefinition, functionScheduler: FunctionScheduler): [string, PGraphNode] {
  return [definition.name, { run: () => functionScheduler.startExecutingFunction(definition), priority: definition.priority }];
}

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Enforces that a particular schedule does not schedule secondTaskName until firstTaskName is complete
       */
      toHaveScheduleOrdering(firstTaskName: string, secondTaskName: string): R;

      /**
       * Enforces that a particular schedule does not schedule secondTaskName to start before firstTaskName has started
       */
      toHaveStartedBefore(firstTaskName: string, secondTaskName: string): R;

      /**
       * Enforces that a specific task was executed
       */
      toHaveScheduledTask(taskName: string): R;
    }
  }
}

expect.extend({
  toHaveScheduleOrdering(callRecords: MockFunctionCallRecord[], firstTaskName: string, secondTaskName: string) {
    const firstIndex = callRecords.findIndex((item) => item.name === firstTaskName && item.state === "end");
    const secondIndex = callRecords.findIndex((item) => item.name === secondTaskName && item.state === "start");

    const pass = firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;

    return {
      message: () => `expected ${secondTaskName} to be scheduled after ${firstTaskName} completed`,
      pass,
    };
  },
  toHaveStartedBefore(callRecords: MockFunctionCallRecord[], firstTaskName: string, secondTaskName: string) {
    const firstIndex = callRecords.findIndex((item) => item.name === firstTaskName && item.state === "start");
    const secondIndex = callRecords.findIndex((item) => item.name === secondTaskName && item.state === "start");

    const pass = firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;

    return {
      message: () => `expected ${secondTaskName} to be started after ${firstTaskName} has started`,
      pass,
    };
  },
  toHaveScheduledTask(callRecords: MockFunctionCallRecord[], taskName: string) {
    const startIndex = callRecords.findIndex((item) => item.name === taskName && item.state === "end");
    const endIndex = callRecords.findIndex((item) => item.name === taskName && item.state === "start");

    const pass = startIndex !== -1 && endIndex !== -1;

    return {
      message: () => `expected to have scheduled task ${taskName}`,
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

  it("throws an exception when the dependency graph has a cycle starting from the root", async () => {
    const nodeMap: PGraphNodeMap = new Map([
      ["A", { run: () => Promise.resolve() }],
      ["B", { run: () => Promise.resolve() }],
      ["C", { run: () => Promise.resolve() }],
    ]);

    const dependencies: DependencyList = [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"],
    ];

    expect(() => pGraph(nodeMap, dependencies)).toThrow();
  });

  it("throws an exception when the dependency graph has a cycle", async () => {
    // This is almost the same as the last test, except the root node is not a part of the cycle
    const nodeMap: PGraphNodeMap = new Map([
      ["A", { run: () => Promise.resolve() }],
      ["B", { run: () => Promise.resolve() }],
      ["C", { run: () => Promise.resolve() }],
      ["D", { run: () => Promise.resolve() }],
    ]);

    const dependencies: DependencyList = [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "B"],
    ];

    expect(() => pGraph(nodeMap, dependencies)).toThrow();
  });

  it("resolves an empty dependnecy graph", async () => {
    const nodeMap: PGraphNodeMap = new Map();

    const dependencies: DependencyList = [];

    expect(pGraph(nodeMap, dependencies).run()).resolves.toBeUndefined();
  });

  it("throws an exception when run is invoked and a task rejects its promise", async () => {
    const nodeMap: PGraphNodeMap = new Map([
      ["A", { run: () => Promise.resolve() }],
      ["B", { run: () => Promise.resolve() }],
      ["C", { run: () => Promise.reject("C rejected") }],
    ]);

    //  A
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    await expect(pGraph(nodeMap, dependencies).run()).rejects.toEqual("C rejected");
  });

  it("throws when one of the dependencies references a node not in the node map", async () => {
    const nodeMap: PGraphNodeMap = new Map([
      ["A", { run: () => Promise.resolve() }],
      ["B", { run: () => Promise.resolve() }],
    ]);

    //  A
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    expect(() => pGraph(nodeMap, dependencies)).toThrow();
  });

  it("should run all dependencies for disconnected graphs", async () => {
    const functionScheduler = new FunctionScheduler();

    const nodeMap: PGraphNodeMap = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 1 }, functionScheduler),
      defineMockNode({ name: "C", duration: 1 }, functionScheduler),
      defineMockNode({ name: "D", duration: 1 }, functionScheduler),
    ]);

    //  A    D
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    await pGraph(nodeMap, dependencies).run();

    const { callRecords } = functionScheduler;
    expect(callRecords).toHaveScheduledTask("A");
    expect(callRecords).toHaveScheduledTask("B");
    expect(callRecords).toHaveScheduledTask("C");
    expect(callRecords).toHaveScheduledTask("D");
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
      ["A", "B"],
      ["A", "C"],
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
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["A", "E"],
    ];

    await pGraph(funcs, dependencies).run({ maxConcurrency: 3 });

    expect(computeMaxConcurrency(functionScheduler.callRecords)).toBeLessThanOrEqual(3);
  });

  it("correctly schedules tasks that have more than one dependency", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 1 }, functionScheduler),
      defineMockNode({ name: "C", duration: 1 }, functionScheduler),
      defineMockNode({ name: "D", duration: 1 }, functionScheduler),
      defineMockNode({ name: "E", duration: 1 }, functionScheduler),
    ]);

    // All nodes depend on A, D depends on C and B as well
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["A", "E"],
      ["C", "D"],
      ["B", "D"],
    ];

    await pGraph(funcs, dependencies).run();

    expect(functionScheduler.callRecords).toHaveScheduleOrdering("A", "B");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("A", "C");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("A", "D");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("A", "E");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("B", "D");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("C", "D");
  });

  it("should schedule high priority tasks and dependencies before lower priority tasks", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 1 }, functionScheduler),
      defineMockNode({ name: "C", duration: 1 }, functionScheduler),
      defineMockNode({ name: "D", duration: 1 }, functionScheduler),
      defineMockNode({ name: "E", duration: 1 }, functionScheduler),
      defineMockNode({ name: "F", duration: 1, priority: 16 }, functionScheduler),
    ]);

    //      A
    //  B   C   D
    //    |E F|
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["C", "E"],
      ["C", "F"],
    ];

    // Set concurrency to 1 to make it easier to validate execution order
    await pGraph(funcs, dependencies).run({ maxConcurrency: 1 });

    // A -> C -> F is the critical path, it should be built first
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("C", "B");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("C", "D");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("F", "E");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("F", "B");
    expect(functionScheduler.callRecords).toHaveScheduleOrdering("F", "D");
  });

  it("should schedule high priority tasks and dependencies before lower priority tasks when maxConcurrency is greater than 1", async () => {
    const functionScheduler = new FunctionScheduler();

    const funcs = new Map([
      defineMockNode({ name: "A", duration: 1 }, functionScheduler),
      defineMockNode({ name: "B", duration: 16, priority: 16 }, functionScheduler),
      defineMockNode({ name: "C", duration: 4, priority: 4 }, functionScheduler),
      defineMockNode({ name: "D", duration: 4, priority: 4 }, functionScheduler),
      defineMockNode({ name: "E", duration: 12, priority: 12 }, functionScheduler),
      defineMockNode({ name: "F", duration: 16, priority: 16 }, functionScheduler),
    ]);

    //      A
    //  B   C   D
    //    |E F|
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["C", "E"],
      ["C", "F"],
    ];

    // Set concurrency to 1 to make it easier to validate execution order
    await pGraph(funcs, dependencies).run({ maxConcurrency: 2 });

    // A -> C -> F is the critical path, it should be built first
    expect(computeMaxConcurrency(functionScheduler.callRecords)).toBeLessThanOrEqual(2);
    expect(functionScheduler.callRecords).toHaveStartedBefore("C", "B");
    expect(functionScheduler.callRecords).toHaveStartedBefore("C", "D");
    expect(functionScheduler.callRecords).toHaveStartedBefore("B", "D");
    expect(functionScheduler.callRecords).toHaveStartedBefore("F", "E");
  });
});
