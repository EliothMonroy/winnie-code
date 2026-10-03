Implement a function that takes an array of integers `nums` and builds a singly linked list from those values, in the same order. Return the head of the linked list.

If the array is empty, return `null`.

The judge reads your list starting from the returned head, following `next` until it reaches `null`. Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: nums = [1,2,3]
Output: [1,2,3]
Explanation: The list is 1 -> 2 -> 3. The head is the node with value 1.
```

**Example 2:**

```
Input: nums = [7]
Output: [7]
Explanation: A single node whose next is null.
```

**Example 3:**

```
Input: nums = []
Output: []
Explanation: The array is empty, so the function returns null.
```

**Constraints:**

- `0 <= nums.length`
- Every `nums[i]` fits in a Kotlin `Int` (`-2147483648 <= nums[i] <= 2147483647`)
- The last node's `next` must be `null` (the list must not contain a cycle)
