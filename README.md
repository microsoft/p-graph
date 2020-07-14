# p-graph

Run a promise graph with concurrency control.

## Install

```
$ npm install p-graph
```

## Usage

The p-graph library takes in a map of of nodes and a list of dependencies. The keys in the map are unique string identifiers for each node in the graph. The value of the map is the definition of the task, including the function that should be executed by that task in it's run argument. The dependencies list is an array of tuples, each tuple contains the two values that must correspond to ids in the node map. The run function corresponding to the first item in the tuple must complete before the second item in the tuple can begin.

The return value of pGraph is a class with a `run()` function. Calling the `run()` function will return a promise that resolves after all the tasks in the graph have finished completed. Tasks are run in dependency order.

```js
const { default: pGraph } = require("p-graph"); // ES6 import also works: import pGraph from 'p-graph';

const nodeMap = new Map([
  ["putOnShirt", { run:  () => Promise.resolve("put on your shirt") })],
  ["putOnShorts", { run: () => Promise.resolve("put on your shorts")})],
  ["putOnJacket", { run: () => Promise.resolve("put on your jacket")})],
  ["putOnShoes", { run: () => Promise.resolve("put on your shoes")}],
  ["tieShoes", { run: () => Promise.resolve("tie your shoes")}],
]);

const dependencies: DependencyList = [
  // You need to put your shoes on before you tie them!
  ["putOnShoes", "tieShoes"],
  ["putOnShirt", "putOnJacket"],
  ["putOnShorts", "putOnJacket"],
  ["putOnShorts", "putOnShoes"],
];

await pGraph(nodeMap, dependencies).run();
```

## Concurrency Limiter

There are some contexts where you may want to limit the number of functions running concurrently. One example would be to prevent overloading the CPU with too many parallel tasks. The concurrency argument to `run` will limit the number of functions that start running at a given time. If no concurrency option is set, the concurrency is not limited and tasks are run as soon as they are unblocked.

```js
await pGraph(graph).run({ concurrency: 3 });
```

## Priority

There are situations where task runner must pick a subset of the currently unblocked tasks to put on the queue. By default, tasks are considered to all be equally important and equally likely to be picked to run once all the tasks they depend on are complete. If you wish to control the ordering of tasks, consider using the priority option when defining a task node. When the task scheduler is picking tasks to run, it will favor tasks with a higher priority over tasks with a lower priority. Tasks will always execute in dependency order.

# Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
