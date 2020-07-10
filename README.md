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

await pGraph(graph).run({ concurrency: 3 }); // returns a promise that will resolve when all the tasks are done from this graph in order
```

## Concurrency Limiter

There are some contexts where you may want to limit the number of functions running concurrently. One example would be to prevent overloading the CPU with too many parallel tasks. The concurrency argument to `run` will limit the number of functions that start running at a given time

```js
await pGraph(graph).run({ maxConcurrency: 3 });
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
