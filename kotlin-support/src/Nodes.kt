/** Singly-linked list node. Like LeetCode's, except the field is `value` instead of the keyword `val`. */
class ListNode(var value: Int) {
    var next: ListNode? = null
}

/** Binary tree node. Like LeetCode's, except the field is `value` instead of the keyword `val`. */
class TreeNode(var value: Int) {
    var left: TreeNode? = null
    var right: TreeNode? = null
}

/** Doubly-linked list node: like ListNode, plus a `prev` pointer to the node before it. */
class DoublyListNode(var value: Int) {
    var prev: DoublyListNode? = null
    var next: DoublyListNode? = null
}
