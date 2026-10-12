Count the number of swaps needed to sort an array in ascending order using bubble sort. This problem builds on your understanding of the bubble sort algorithm by tracking how many swap operations are performed.

Bubble sort repeatedly passes over the list comparing each pair of adjacent elements, and swaps a pair only when the left element is greater than the right one. Equal elements are never swapped.

Given a list of integers `arr`, return the total number of swaps performed.

**Example 1:**

```
Input: arr = [1,2,3,4,5]
Output: 0
Explanation: The array is already sorted, so no swaps are needed.
```

**Example 2:**

```
Input: arr = [5,4,3,2,1]
Output: 10
Explanation: This is the worst case (reverse sorted).
Pass 1: 4 swaps (5 bubbles to the end)
Pass 2: 3 swaps (4 bubbles to position)
Pass 3: 2 swaps (3 bubbles to position)
Pass 4: 1 swap (2 bubbles to position)
Total: 4 + 3 + 2 + 1 = 10 swaps
```

**Example 3:**

```
Input: arr = [3,1,4,2]
Output: 3
Explanation:
Pass 1: (3,1) swap, (3,4) no swap, (4,2) swap -> 2 swaps -> [1,3,2,4]
Pass 2: (1,3) no swap, (3,2) swap -> 1 swap -> [1,2,3,4]
Total: 3 swaps
```

**Constraints:**

- `0 <= arr.length <= 1000`
- Every `arr[i]` fits in a Kotlin `Int`
- `arr` may contain duplicates
