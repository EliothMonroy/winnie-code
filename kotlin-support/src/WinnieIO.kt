import java.util.ArrayDeque
import java.util.Collections
import java.util.IdentityHashMap
import java.util.LinkedList

/** Converts between LeetCode literal notation and Kotlin values. Used by the generated Main.kt. */
object WinnieIO {
    fun parse(text: String): WinnieLit = WinnieLitParser.parse(text)

    // ---- decoding ----

    fun items(l: WinnieLit): List<WinnieLit> = (l as? WinnieLit.Arr)?.items ?: mismatch("an array", l)

    fun int(l: WinnieLit): Int = number(l, "an Int").toIntOrNull() ?: mismatch("an Int", l)

    fun long(l: WinnieLit): Long = number(l, "a Long").toLongOrNull() ?: mismatch("a Long", l)

    fun double(l: WinnieLit): Double = number(l, "a Double").toDouble()

    fun bool(l: WinnieLit): Boolean = (l as? WinnieLit.Bool)?.value ?: mismatch("a Boolean", l)

    fun str(l: WinnieLit): String = (l as? WinnieLit.Str)?.value ?: mismatch("a String", l)

    fun char(l: WinnieLit): Char {
        val s = (l as? WinnieLit.Str)?.value
        if (s == null || s.length != 1) mismatch("a one-character string", l)
        return s[0]
    }

    fun listNode(l: WinnieLit): ListNode? {
        val dummy = ListNode(0)
        var tail = dummy
        for (item in items(l)) {
            val node = ListNode(int(item))
            tail.next = node
            tail = node
        }
        return dummy.next
    }

    fun treeNode(l: WinnieLit): TreeNode? {
        val values = items(l)
        if (values.isEmpty() || values[0] is WinnieLit.Null) return null
        val root = TreeNode(int(values[0]))
        val queue = ArrayDeque<TreeNode>()
        queue.add(root)
        var i = 1
        while (i < values.size) {
            val parent = queue.poll() ?: throw IllegalArgumentException("Invalid tree literal: too many values")
            if (values[i] !is WinnieLit.Null) {
                val node = TreeNode(int(values[i]))
                parent.left = node
                queue.add(node)
            }
            i++
            if (i < values.size && values[i] !is WinnieLit.Null) {
                val node = TreeNode(int(values[i]))
                parent.right = node
                queue.add(node)
            }
            i++
        }
        return root
    }

    // ---- encoding (canonical LeetCode notation, no spaces) ----

    fun encInt(v: Int): String = v.toString()

    fun encLong(v: Long): String = v.toString()

    fun encDouble(v: Double): String = v.toString()

    fun encBool(v: Boolean): String = v.toString()

    fun encChar(v: Char): String = quote(v.toString())

    fun encStr(v: String): String = quote(v)

    fun encSeq(items: List<String>): String = items.joinToString(",", "[", "]")

    fun encListNode(head: ListNode?): String {
        val seen = Collections.newSetFromMap(IdentityHashMap<ListNode, Boolean>())
        val out = ArrayList<String>()
        var cur = head
        while (cur != null) {
            if (!seen.add(cur)) throw IllegalStateException("The returned linked list contains a cycle")
            out.add(cur.`val`.toString())
            cur = cur.next
        }
        return encSeq(out)
    }

    fun encTreeNode(root: TreeNode?): String {
        if (root == null) return "[]"
        val seen = Collections.newSetFromMap(IdentityHashMap<TreeNode, Boolean>())
        val out = ArrayList<String>()
        val queue = LinkedList<TreeNode?>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (node == null) {
                out.add("null")
                continue
            }
            if (!seen.add(node)) throw IllegalStateException("The returned tree contains a cycle")
            out.add(node.`val`.toString())
            queue.add(node.left)
            queue.add(node.right)
        }
        while (out.last() == "null") out.removeAt(out.size - 1)
        return encSeq(out)
    }

    fun quote(s: String): String {
        val sb = StringBuilder("\"")
        for (c in s) {
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' -> sb.append("\\u%04x".format(c.code))
                else -> sb.append(c)
            }
        }
        return sb.append('"').toString()
    }

    /** Canonical text of a literal, used in error messages. */
    fun render(l: WinnieLit): String = when (l) {
        is WinnieLit.Num -> l.text
        is WinnieLit.Str -> quote(l.value)
        is WinnieLit.Bool -> l.value.toString()
        WinnieLit.Null -> "null"
        is WinnieLit.Arr -> encSeq(l.items.map { render(it) })
    }

    private fun number(l: WinnieLit, what: String): String = (l as? WinnieLit.Num)?.text ?: mismatch(what, l)

    private fun mismatch(what: String, l: WinnieLit): Nothing =
        throw IllegalArgumentException("Expected $what but got ${render(l).take(100)}")
}
