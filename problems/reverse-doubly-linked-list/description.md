Given the `head` of a doubly linked list, reverse it so the old tail becomes the new head, and return the new head. Reversing means every node's `prev` and `next` swap places.

The list may be empty: if `head` is `null`, return `null`.

Doubly linked lists are shown in array notation: `[1,2,3]` means `1 <-> 2 <-> 3`, and `[]` means `null`. The judge reads your list by following `next` from the head you return, and it also checks every `prev` pointer: the head's `prev` must be `null`, and each other node's `prev` must point to the node before it.

**Example 1:**

```
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]
Explanation: 1 <-> 2 <-> 3 <-> 4 <-> 5 becomes 5 <-> 4 <-> 3 <-> 2 <-> 1.
```

**Example 2:**

```
Input: head = [5]
Output: [5]
Explanation: A single node reverses to itself.
```

**Constraints:**

- The number of nodes in the list is `0` or more
- Every node's value fits in a Kotlin `Int`
- The input list is well formed: `prev` and `next` are consistent, and there is no cycle
