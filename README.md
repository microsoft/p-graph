# p-graph

Run a promise graph with concurrency control.

## Install

```
$ npm install p-graph
```

## Usage

The p-graph library takes in a `graph` argument. To start, create a graph of functions that return promises (let's call them Run Functions), then run them through the pGraph API:

```js
const { default: pGraph } = require("p-graph"); // ES6 import also works: import pGraph from 'p-graph';

const putOnShirt = () => Promise.resolve("put on your shirt");
const putOnShorts = () => Promise.resolve("put on your shorts");
const putOnJacket = () => Promise.resolve("put on your jacket");
const putOnShoes = () => Promise.resolve("put on your shoes");
const tieShoes = () => Promise.resolve("tie your shoes");

const graph = [
  [putOnShoes, tieShoes],
  [putOnShirt, putOnJacket],
  [putOnShorts, putOnJacket],
  [putOnShorts, putOnShoes],
];

await pGraph(graph, { concurrency: 3 }).run(); // returns a promise that will resolve when all the tasks are done from this graph in order
```

### Ways to define a graph

1. Use a dependency array

```js
const putOnShirt = () => Promise.resolve("put on your shirt");
const putOnShorts = () => Promise.resolve("put on your shorts");
const putOnJacket = () => Promise.resolve("put on your jacket");
const putOnShoes = () => Promise.resolve("put on your shoes");
const tieShoes = () => Promise.resolve("tie your shoes");

const graph = [
  [putOnShoes, tieShoes],
  [putOnShirt, putOnJacket],
  [putOnShorts, putOnJacket],
  [putOnShorts, putOnShoes],
];

await pGraph(graph);
```

2. Use a dependency array with a list of named functions

```js
const funcs = new Map();

funcs.set("putOnShirt", () => Promise.resolve("put on your shirt"));
funcs.set("putOnShorts", () => Promise.resolve("put on your shorts"));
funcs.set("putOnJacket", () => Promise.resolve("put on your jacket"));
funcs.set("putOnShoes", () => Promise.resolve("put on your shoes"));
funcs.set("tieShoes", () => Promise.resolve("tie your shoes"));

const graph = [
  ["putOnShoes", "tieShoes"],
  ["putOnShirt", "putOnJacket"],
  ["putOnShorts", "putOnJacket"],
  ["putOnShorts", "putOnShoes"],
];

await pGraph(funcs, graph);
```

3. Use a dependency map with a list of named functions

```js
const funcs = new Map();

funcs.set("putOnShirt", () => Promise.resolve("put on your shirt"));
funcs.set("putOnShorts", () => Promise.resolve("put on your shorts"));
funcs.set("putOnJacket", () => Promise.resolve("put on your jacket"));
funcs.set("putOnShoes", () => Promise.resolve("put on your shoes"));
funcs.set("tieShoes", () => Promise.resolve("tie your shoes"));

const depMap = new Map();

depMap.set("tieShoes", new Set(["putOnShoes"]));
depMap.set("putOnJacket", new Set(["putOnShirt", "putOnShorts"]));
depMap.set("putOnShoes", new Set(["putOnShorts"]));
depMap.set("putOnShorts", new Set());
depMap.set("putOnShirt", new Set());

await pGraph(funcs, depMap);
```

### Using the ID as argument to the same function

In many cases, the jobs that need to run are the same where the only difference is the arguments for the function. In that case, you can treat the IDs as arguments as they are passed into the Run Function.

```ts
type Id = unknown;
type RunFunction = (id: Id) => Promise<unknown>;
```

As you can see, the ID can be anything. It will be passed as the argument for your Run Function. This is a good option if having a large number of functions inside a graph is prohibitive in memory sensitive situations.

```js
const funcs = new Map();
const thatImportantTask = (id) => Promise.resolve(id);

funcs.set("putOnShirt", thatImportantTask);
funcs.set("putOnShorts", thatImportantTask);
funcs.set("putOnJacket", thatImportantTask);
funcs.set("putOnShoes", thatImportantTask);
funcs.set("tieShoes", thatImportantTask);
```

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
