Given the `head` of a singly linked list and a `value`, delete all nodes that have the given value and return the head of the modified list.

The remaining nodes must keep their original order. If every node is deleted, the result is an empty list, so the function returns `null`.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: head = [1,2,3,2,4], value = 2
Output: [1,3,4]
Explanation: Remove all nodes with value 2.
```

**Example 2:**

```
Input: head = [1,1,1], value = 1
Output: []
Explanation: All nodes have value 1, so the result is an empty list.
```

**Example 3:**

```
Input: head = [1,2,3], value = 4
Output: [1,2,3]
Explanation: Value 4 doesn't exist, so the list is unchanged.
```

**Constraints:**

- The list may be empty
- The value may or may not exist in the list
- Multiple nodes may have the same value
- `value` and every node's value fit in a Kotlin `Int`
