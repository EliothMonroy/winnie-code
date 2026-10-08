Given an array of integers `arr`, count how many times each number appears. Return a hash map where the keys are the numbers from the array and the values are their frequencies.

Hash maps are shown as `{key: value, ...}`, and `{}` is an empty map. The order of the entries does not matter: your result is compared after sorting by key, and it is displayed sorted too.

**Example 1:**

```
Input: arr = [1,2,2,3,3,3]
Output: {1: 1, 2: 2, 3: 3}
Explanation: 1 appears once, 2 appears twice, 3 appears three times.
```

**Example 2:**

```
Input: arr = [5,5,5,5]
Output: {5: 4}
Explanation: 5 appears four times.
```

**Example 3:**

```
Input: arr = [1,2,3,4]
Output: {1: 1, 2: 1, 3: 1, 4: 1}
Explanation: Each number appears exactly once.
```

**Constraints:**

- `0 <= arr.length`
- Every `arr[i]` fits in a Kotlin `Int`
- A number that does not appear in `arr` must not be a key in the map
