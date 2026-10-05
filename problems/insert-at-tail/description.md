Implement a function that inserts a new node with the given `value` at the tail of a singly linked list. Return the head of the list.

The existing nodes must stay in their original order before the new node. If the list is empty (`head` is `null`), the new node is the whole list, so it is also the head.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: head = [1,2,3], value = 4
Output: [1,2,3,4]
Explanation: The old tail 3 now points to the new node 4. The head is still 1.
```

**Example 2:**

```
Input: head = [], value = 5
Output: [5]
Explanation: The list was empty, so the new node is the head.
```

**Example 3:**

```
Input: head = [7], value = 7
Output: [7,7]
```

**Constraints:**

- The number of nodes in the list is `0` or more
- `value` and every node's value fit in a Kotlin `Int`
- The list has no cycle: the last node's `next` is `null`
