interface PriorityQueueItem<T> {
  item: T;

  priority: number;
}

export class PriorityQueue<T> {
  private array: PriorityQueueItem<T>[] = [];

  private swapElements(firstIndex: number, secondIndex: number) {
    const firstItem = this.array[firstIndex];
    const secondItem = this.array[secondIndex];

    this.array[firstIndex] = secondItem;
    this.array[secondIndex] = firstItem;
  }

  public isEmpty() {
    return this.array.length === 0;
  }

  public insert(item: T, priority: number) {
    // The index to check to ensure the max heap property is preserved
    let indexToCheck = this.array.length;

    this.array.push({ item, priority });

    while (indexToCheck > 0) {
      const parentIndex = Math.floor((indexToCheck - 1) / 2);

      if (this.array[indexToCheck].priority > this.array[parentIndex].priority) {
        this.swapElements(indexToCheck, parentIndex);
        indexToCheck = parentIndex;
      } else {
        break;
      }
    }
  }

  public removeMax(): T | undefined {
    const result = this.array.shift();

    let indexToCheck = 0;

    while (indexToCheck < this.array.length) {
      const leftChildIndex = indexToCheck * 2 + 1;
      const rightChildIndex = indexToCheck * 2 + 2;

      const biggerIndex = this.array[leftChildIndex] > this.array[rightChildIndex] ? leftChildIndex : rightChildIndex;

      if (this.array[biggerIndex] > this.array[indexToCheck]) {
        this.swapElements(indexToCheck, biggerIndex);
        indexToCheck = biggerIndex;
      } else {
        break;
      }
    }

    return result?.item;
  }
}
