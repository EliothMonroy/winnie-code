Implement a function that counts the number of nodes in a singly linked list. Given the `head` of the list, return the total number of nodes.

If the list is empty (`head` is `null`), return `0`.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: head = [1,2,3]
Output: 3
Explanation: The list 1 -> 2 -> 3 has three nodes.
```

**Example 2:**

```
Input: head = [7]
Output: 1
```

**Example 3:**

```
Input: head = []
Output: 0
Explanation: head is null, so there are no nodes.
```

**Constraints:**

- The number of nodes is `0` or more
- Every node's value fits in a Kotlin `Int`
- The list has no cycle: the last node's `next` is `null`
