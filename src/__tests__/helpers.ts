import type { PGraphNodeMap } from "../types";

interface MockFunctionDefinition {
  /** A friendly name for the function */
  name: string;

  /** How many ticks this function should take to simulate the duration of the function execution */
  duration: number;

  /** Priority value to pass to the PGraphNode that is created */
  priority?: number;
}

/** A record of a function start or end event that can be composed to create an ordered log of function calls **/
interface MockFunctionCallRecord {
  /** The name of the function */
  name: string;

  /** Denotes if this is when the function started or ended execution */
  state: "start" | "end";
}

export class FunctionScheduler {
  public readonly callRecords: MockFunctionCallRecord[] = [];

  /** Node map which can be passed to `PGraph` */
  public readonly nodeMap: PGraphNodeMap = new Map();

  #currentlyRunningFunctions: Array<{
    name: string;
    ticksRemaining: number;
    resolve: () => void;
  }> = [];

  #tickScheduled: boolean = false;

  /**
   * Add a node to `this.nodeMap`, which can be passed to `PGraph`.
   * The node will have a `run` function that runs for a given number of ticks and records
   * the run in `this.callRecords`.
   */
  public addNode(definition: MockFunctionDefinition): void {
    this.nodeMap.set(definition.name, {
      run: () => this.#runFunction(definition),
      priority: definition.priority,
    });
  }

  #runFunction(definition: MockFunctionDefinition): Promise<void> {
    const { name, duration } = definition;
    this.callRecords.push({ name, state: "start" });

    const promise = new Promise<void>((resolve) => {
      this.#currentlyRunningFunctions.push({ name, ticksRemaining: duration, resolve });
    });

    this.#ensureTickScheduled();

    return promise;
  }

  #ensureTickScheduled() {
    if (this.#tickScheduled) return;

    this.#tickScheduled = true;
    Promise.resolve().then(() => this.#tick());
  }

  #tick() {
    this.#tickScheduled = false;
    for (const item of this.#currentlyRunningFunctions) {
      item.ticksRemaining--;
    }

    const finishedItems = this.#currentlyRunningFunctions.filter(
      (item) => item.ticksRemaining === 0,
    );
    this.#currentlyRunningFunctions = this.#currentlyRunningFunctions.filter(
      (item) => item.ticksRemaining !== 0,
    );

    for (const item of finishedItems) {
      item.resolve();
      this.callRecords.push({ name: item.name, state: "end" });
    }

    if (this.#currentlyRunningFunctions.length > 0) {
      this.#ensureTickScheduled();
    }
  }
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
  toHaveScheduleOrdering(
    callRecords: MockFunctionCallRecord[],
    firstTaskName: string,
    secondTaskName: string,
  ) {
    const firstIndex = callRecords.findIndex(
      (item) => item.name === firstTaskName && item.state === "end",
    );
    const secondIndex = callRecords.findIndex(
      (item) => item.name === secondTaskName && item.state === "start",
    );

    const pass = firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;

    return {
      message: () => `expected ${secondTaskName} to be scheduled after ${firstTaskName} completed`,
      pass,
    };
  },
  toHaveStartedBefore(
    callRecords: MockFunctionCallRecord[],
    firstTaskName: string,
    secondTaskName: string,
  ) {
    const firstIndex = callRecords.findIndex(
      (item) => item.name === firstTaskName && item.state === "start",
    );
    const secondIndex = callRecords.findIndex(
      (item) => item.name === secondTaskName && item.state === "start",
    );

    const pass = firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;

    return {
      message: () => `expected ${secondTaskName} to be started after ${firstTaskName} has started`,
      pass,
    };
  },
  toHaveScheduledTask(callRecords: MockFunctionCallRecord[], taskName: string) {
    const startIndex = callRecords.findIndex(
      (item) => item.name === taskName && item.state === "end",
    );
    const endIndex = callRecords.findIndex(
      (item) => item.name === taskName && item.state === "start",
    );

    const pass = startIndex !== -1 && endIndex !== -1;

    return {
      message: () => `expected to have scheduled task ${taskName}`,
      pass,
    };
  },
});

export function computeMaxConcurrency(callRecords: MockFunctionCallRecord[]) {
  let currentConcurrency = 0;
  let maxConcurrencySoFar = 0;

  for (const record of callRecords) {
    currentConcurrency += record.state === "start" ? 1 : -1;
    maxConcurrencySoFar = Math.max(currentConcurrency, maxConcurrencySoFar);
  }

  return maxConcurrencySoFar;
}
