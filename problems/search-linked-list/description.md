Implement a function that searches for a `target` value in a singly linked list. Return `1` if the value is found, and `0` otherwise.

A linked list has no index to jump to, so the search has to walk the list node by node from the head. In the worst case it visits every node, which is why searching a linked list takes O(n) time.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: head = [1,2,3], target = 2
Output: 1
Explanation: 2 is in the list.
```

**Example 2:**

```
Input: head = [1,2,3], target = 4
Output: 0
Explanation: 4 is not in the list.
```

**Example 3:**

```
Input: head = [], target = 1
Output: 0
Explanation: An empty list contains no values.
```

**Constraints:**

- The number of nodes in the list is `0` or more
- `target` and every node's value fit in a Kotlin `Int`
- The list has no cycle: the last node's `next` is `null`
