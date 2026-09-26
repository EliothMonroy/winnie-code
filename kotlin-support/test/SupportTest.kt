import kotlin.system.exitProcess

val failures = mutableListOf<String>()

fun check(name: String, actual: Any?, expected: Any?) {
    if (actual != expected) failures.add("$name: expected <$expected> but was <$actual>")
}

fun errorOf(block: () -> Any?): String? = runCatching(block).exceptionOrNull()?.message

fun lit(text: String): WinnieLit = WinnieIO.parse(text)

fun intList(text: String): String = WinnieIO.encSeq(WinnieIO.items(lit(text)).map { WinnieIO.encInt(WinnieIO.int(it)) })

fun tree(text: String): String = WinnieIO.encTreeNode(WinnieIO.treeNode(lit(text)))

fun main() {
    // Scalars
    check("int", WinnieIO.encInt(WinnieIO.int(lit(" 42 "))), "42")
    check("negative int", WinnieIO.encInt(WinnieIO.int(lit("-7"))), "-7")
    check("long", WinnieIO.encLong(WinnieIO.long(lit("9007199254740993"))), "9007199254740993")
    check("double normalizes", WinnieIO.encDouble(WinnieIO.double(lit("2.00000"))), "2.0")
    check("double exponent", WinnieIO.encDouble(WinnieIO.double(lit("1e-5"))), "1.0E-5")
    check("bool", WinnieIO.encBool(WinnieIO.bool(lit("true"))), "true")
    check("char", WinnieIO.encChar(WinnieIO.char(lit("\"a\""))), "\"a\"")
    check("string escapes", WinnieIO.encStr(WinnieIO.str(lit("\"a\\\"b\\\\c\\n\""))), "\"a\\\"b\\\\c\\n\"")
    check("unicode escape", WinnieIO.str(lit("\"\\u00e9\"")), "é")
    check("control char quoting", WinnieIO.quote("\u0001"), "\"\\u0001\"")

    // Arrays and lists
    check("int list", intList("[1, 2 ,3]"), "[1,2,3]")
    check("empty list", intList("[]"), "[]")
    check(
        "nested list",
        WinnieIO.encSeq(WinnieIO.items(lit("[[1,2],[],[3]]")).map { row ->
            WinnieIO.encSeq(WinnieIO.items(row).map { WinnieIO.encInt(WinnieIO.int(it)) })
        }),
        "[[1,2],[],[3]]",
    )
    check("render", WinnieIO.render(lit("[ \"x\" , null, true, 1.50 ]")), "[\"x\",null,true,1.50]")

    // Linked lists
    check("list node", WinnieIO.encListNode(WinnieIO.listNode(lit("[1,2,3]"))), "[1,2,3]")
    check("empty list node", WinnieIO.listNode(lit("[]")), null)
    check("null list node encodes as []", WinnieIO.encListNode(null), "[]")
    val cyclic = ListNode(1)
    cyclic.next = cyclic
    check("list cycle", errorOf { WinnieIO.encListNode(cyclic) }, "The returned linked list contains a cycle")

    // Trees
    for (t in listOf("[3,9,20,null,null,15,7]", "[1,null,2,3]", "[1]", "[5,4,8,11,null,13,4,7,2,null,null,null,1]")) {
        check("tree $t", tree(t), t)
    }
    check("tree trailing nulls trimmed", tree("[1,2,null,null,null]"), "[1,2]")
    check("empty tree", WinnieIO.treeNode(lit("[]")), null)
    check("null root", WinnieIO.treeNode(lit("[null]")), null)
    check("null tree encodes as []", WinnieIO.encTreeNode(null), "[]")
    check("tree structure", WinnieIO.treeNode(lit("[1,null,2]"))?.right?.`val`, 2)
    check("tree too many values", errorOf { WinnieIO.treeNode(lit("[1,null,null,2]")) }, "Invalid tree literal: too many values")

    // Errors
    check("type mismatch", errorOf { WinnieIO.int(lit("\"x\"")) }, "Expected an Int but got \"x\"")
    check("char length", errorOf { WinnieIO.char(lit("\"ab\"")) }, "Expected a one-character string but got \"ab\"")
    check("unterminated array", errorOf { lit("[1,2") } != null, true)
    check("trailing characters", errorOf { lit("1 2") } != null, true)
    check("bad token", errorOf { lit("[1,x]") } != null, true)

    if (failures.isEmpty()) {
        println("ALL PASSED")
    } else {
        failures.forEach { println("FAIL $it") }
        exitProcess(1)
    }
}
