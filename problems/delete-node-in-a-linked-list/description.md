In every linked list deletion you've seen so far, the approach starts from `head`: traverse to the node before the target, then rewire its `next` pointer to skip over it. That works because starting from `head` lets you reach any predecessor.

The classic interview variant of this problem removes that starting point. You receive only a pointer to a node inside the list: no `head`, and no way to navigate backward. In a singly linked list there is no `prev` pointer, so once you are at a node you cannot reach anything that came before it. The standard rewiring approach simply does not apply.

Your challenge is to make the list look, from the outside, exactly as if the target node were deleted, using only the target node and the nodes that come after it.

This exercise still has to hand you a list and point you at a target node, so the function takes `head` and `position`. Treat those as setup only: `position` tells you how many steps to walk from `head` to reach the target node. Once you arrive there, the interview constraint applies in full: you may only read or modify the target node and the nodes after it. Using `head` to find the target's predecessor defeats the exercise, even though `head` is sitting right there in scope.

Return the head of the modified list.

**Note:** the judge only checks the final list, so it cannot tell whether you followed the constraint. Sticking to it is up to you.

Linked lists are shown in array notation: `[1,2,3]` means `1 -> 2 -> 3`.

**Example 1:**

```
Input: head = [1,2,3,4], position = 2
Output: [1,3,4]
Explanation: Delete the node at position 2 (value 2).
```

**Example 2:**

```
Input: head = [4,5,1,9], position = 3
Output: [4,5,9]
Explanation: Delete the node at position 3 (value 1).
```

**Constraints:**

- The list has at least 2 nodes
- The node to delete is not the last node
- `position` is valid and 1-indexed (`1 <= position < length of list`)
