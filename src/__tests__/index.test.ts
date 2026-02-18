import type { DependencyList, PGraphNodeMap, PGraphNodeRecord } from "../types";
import { computeMaxConcurrency, FunctionScheduler } from "./helpers";
import { PGraph } from "../PGraph";

describe("pGraph", () => {
  /** Make a map with the given keys and no-op runner functions (`jest.fn()`) */
  function makeNoOpMap(keys: string[]): PGraphNodeMap {
    return new Map(keys.map((key) => [key, { run: jest.fn() }]));
  }

  it("resolves an empty dependency graph", async () => {
    expect(new PGraph(new Map(), []).run()).resolves.toBeUndefined();
  });

  it("accepts the dependency graph and executes tasks in order", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "putOnShirt", duration: 1 });
    scheduler.addNode({ name: "putOnShorts", duration: 1 });
    scheduler.addNode({ name: "putOnJacket", duration: 1 });
    scheduler.addNode({ name: "putOnShoes", duration: 1 });
    scheduler.addNode({ name: "tieShoes", duration: 1 });

    const dependencies: DependencyList = [
      ["putOnShoes", "tieShoes"],
      ["putOnShirt", "putOnJacket"],
      ["putOnShorts", "putOnJacket"],
      ["putOnShorts", "putOnShoes"],
    ];

    await new PGraph(scheduler.nodeMap, dependencies).run();

    const { callRecords } = scheduler;
    expect(callRecords).toHaveScheduleOrdering("putOnShoes", "tieShoes");
    expect(callRecords).toHaveScheduleOrdering("putOnShirt", "putOnJacket");
    expect(callRecords).toHaveScheduleOrdering("putOnShorts", "putOnJacket");
    expect(callRecords).toHaveScheduleOrdering("putOnShorts", "putOnShoes");
  });

  it("accepts the dependency graph as an object", async () => {
    const called: string[] = [];
    const nodeMap: PGraphNodeRecord = {
      A: { run: jest.fn(() => called.push("A")) },
      B: { run: jest.fn(() => called.push("B")) },
    };

    const dependencies: DependencyList = [["B", "A"]];

    await new PGraph(nodeMap, dependencies).run();
    expect(called).toEqual(["B", "A"]);
  });

  it("throws an exception when the dependency graph has a cycle starting from the root", async () => {
    const nodeMap = makeNoOpMap(["A", "B", "C"]);
    const dependencies: DependencyList = [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"],
    ];

    expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(
      `"We could not find a node in the graph with no dependencies; this likely means there is a cycle including all nodes"`,
    );
  });

  it("throws an exception with detailed message when the dependency graph has a cycle", async () => {
    // This is almost the same as the last test, except the root node is not a part of the cycle
    const nodeMap = makeNoOpMap(["A", "B", "C", "D"]);
    const dependencies: DependencyList = [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "B"],
    ];
    expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(`
     "A cycle has been detected including the following nodes:
     A
     B
     C
     D"
    `);
  });

  it("throws an exception in the first instance of a cycle that has been detected when there are overlapped cycles", async () => {
    // This is almost the same as the last test, except the root node is not a part of the cycle
    const nodeMap = makeNoOpMap(["A", "B", "C", "D", "E", "F"]);
    // B -> C -> E -> F -> D is the first cycle detected
    const dependencies: DependencyList = [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "B"],
      ["C", "E"],
      ["E", "F"],
      ["F", "D"],
    ];

    expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(`
     "A cycle has been detected including the following nodes:
     A
     B
     C
     D
     E
     F"
    `);
  });

  it("throws an exception when run is invoked and a task rejects its promise", async () => {
    const nodeMap = makeNoOpMap(["A", "B"]);
    nodeMap.set("C", { run: () => Promise.reject("C rejected") });

    //  A
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    await expect(new PGraph(nodeMap, dependencies).run()).rejects.toContain("C rejected");
  });

  it("throws an exception, but continues to run the entire graph", async () => {
    const nodeMap = makeNoOpMap(["A", "B", "D", "E", "F"]);
    nodeMap.set("C", { run: () => Promise.reject("C rejected") });

    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["C", "D"],
      ["A", "E"],
      ["E", "F"],
    ];

    await expect(
      new PGraph(nodeMap, dependencies).run({ concurrency: 1, continue: true }),
    ).rejects.toContain("C rejected");
    expect(nodeMap.get("E")!.run).toHaveBeenCalled();
    expect(nodeMap.get("F")!.run).toHaveBeenCalled();
    expect(nodeMap.get("D")!.run).not.toHaveBeenCalled();
  });

  it("throws when one of the dependencies references a node not in the node map", async () => {
    const nodeMap = makeNoOpMap(["A", "B"]);

    //  A
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    expect(() => new PGraph(nodeMap, dependencies)).toThrow();
  });

  it("should run all dependencies for disconnected graphs", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 1 });
    scheduler.addNode({ name: "C", duration: 1 });
    scheduler.addNode({ name: "D", duration: 1 });

    //  A    D
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    await new PGraph(scheduler.nodeMap, dependencies).run();

    const { callRecords } = scheduler;
    expect(callRecords).toHaveScheduledTask("A");
    expect(callRecords).toHaveScheduledTask("B");
    expect(callRecords).toHaveScheduledTask("C");
    expect(callRecords).toHaveScheduledTask("D");
  });

  it("should be able to run more than one task at a time", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 1 });
    scheduler.addNode({ name: "C", duration: 1 });

    //  A
    // B C
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
    ];

    await new PGraph(scheduler.nodeMap, dependencies).run();

    // B and C should run concurrently
    expect(computeMaxConcurrency(scheduler.callRecords)).toEqual(2);
  });

  it("should not exceed maximum concurrency", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 1 });
    scheduler.addNode({ name: "C", duration: 1 });
    scheduler.addNode({ name: "D", duration: 1 });
    scheduler.addNode({ name: "E", duration: 1 });

    //    A
    // B C D E
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["A", "E"],
    ];

    await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 3 });

    expect(computeMaxConcurrency(scheduler.callRecords)).toBeLessThanOrEqual(3);
  });

  it("correctly schedules tasks that have more than one dependency", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 1 });
    scheduler.addNode({ name: "C", duration: 1 });
    scheduler.addNode({ name: "D", duration: 1 });
    scheduler.addNode({ name: "E", duration: 1 });

    // All nodes depend on A, D depends on C and B as well
    const dependencies: DependencyList = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["A", "E"],
      ["C", "D"],
      ["B", "D"],
    ];

    await new PGraph(scheduler.nodeMap, dependencies).run();

    expect(scheduler.callRecords).toHaveScheduleOrdering("A", "B");
    expect(scheduler.callRecords).toHaveScheduleOrdering("A", "C");
    expect(scheduler.callRecords).toHaveScheduleOrdering("A", "D");
    expect(scheduler.callRecords).toHaveScheduleOrdering("A", "E");
    expect(scheduler.callRecords).toHaveScheduleOrdering("B", "D");
    expect(scheduler.callRecords).toHaveScheduleOrdering("C", "D");
  });

  it("schedules high priority tasks and dependencies before lower priority tasks", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 1 });
    scheduler.addNode({ name: "C", duration: 1 });
    scheduler.addNode({ name: "D", duration: 1 });
    scheduler.addNode({ name: "E", duration: 1 });
    scheduler.addNode({ name: "F", duration: 1, priority: 16 });

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
    await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 1 });

    // A -> C -> F is the critical path, it should be built first
    expect(scheduler.callRecords).toHaveScheduleOrdering("C", "B");
    expect(scheduler.callRecords).toHaveScheduleOrdering("C", "D");
    expect(scheduler.callRecords).toHaveScheduleOrdering("F", "E");
    expect(scheduler.callRecords).toHaveScheduleOrdering("F", "B");
    expect(scheduler.callRecords).toHaveScheduleOrdering("F", "D");
  });

  it("schedules high priority tasks and dependencies before lower priority tasks when maxConcurrency is greater than 1", async () => {
    const scheduler = new FunctionScheduler();
    scheduler.addNode({ name: "A", duration: 1 });
    scheduler.addNode({ name: "B", duration: 16, priority: 16 });
    scheduler.addNode({ name: "C", duration: 4, priority: 4 });
    scheduler.addNode({ name: "D", duration: 4, priority: 4 });
    scheduler.addNode({ name: "E", duration: 12, priority: 12 });
    scheduler.addNode({ name: "F", duration: 16, priority: 16 });

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
    await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 2 });

    // A -> C -> F is the critical path, it should be built first
    const { callRecords } = scheduler;
    expect(computeMaxConcurrency(callRecords)).toBeLessThanOrEqual(2);
    expect(callRecords).toHaveStartedBefore("C", "B");
    expect(callRecords).toHaveStartedBefore("C", "D");
    expect(callRecords).toHaveStartedBefore("B", "D");
    expect(callRecords).toHaveStartedBefore("F", "E");
  });
});
