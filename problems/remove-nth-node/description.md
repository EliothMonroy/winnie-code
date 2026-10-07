Given the `head` of a singly linked list and an integer `n`, remove the n-th node from the list and return the head of the modified list.

Positions are 1-indexed and counted from the head: `n = 1` removes the head node.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`, and `[]` means `null`.

**Example 1:**

```
Input: head = [1,2,3], n = 1
Output: [2,3]
Explanation: Remove the 1st node (value 1), return [2,3].
```

**Example 2:**

```
Input: head = [1,2,3], n = 2
Output: [1,3]
Explanation: Remove the 2nd node (value 2), return [1,3].
```

**Example 3:**

```
Input: head = [1,2,3], n = 3
Output: [1,2]
Explanation: Remove the 3rd node (value 3), return [1,2].
```

**Constraints:**

- The list has at least 1 node
- `n` is a valid position in the list (`1 <= n <= length of list`)
- If the list has a single node, removing it leaves an empty list, so the function returns `null`
