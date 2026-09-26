/** A value written in LeetCode literal notation: numbers, "strings", true/false, null and [arrays]. */
sealed class WinnieLit {
    data class Num(val text: String) : WinnieLit()
    data class Str(val value: String) : WinnieLit()
    data class Bool(val value: Boolean) : WinnieLit()
    data object Null : WinnieLit()
    data class Arr(val items: List<WinnieLit>) : WinnieLit()
}

class WinnieLitParser private constructor(private val src: String) {
    private var pos = 0

    companion object {
        fun parse(text: String): WinnieLit {
            val parser = WinnieLitParser(text)
            parser.skipWhitespace()
            val value = parser.value()
            parser.skipWhitespace()
            if (parser.pos != text.length) parser.fail("unexpected trailing characters")
            return value
        }
    }

    private fun fail(message: String): Nothing =
        throw IllegalArgumentException("Invalid literal at position $pos: $message in: ${src.take(200)}")

    private fun skipWhitespace() {
        while (pos < src.length && src[pos].isWhitespace()) pos++
    }

    private fun value(): WinnieLit {
        if (pos >= src.length) fail("unexpected end of input")
        val c = src[pos]
        return when {
            c == '[' -> array()
            c == '"' -> WinnieLit.Str(string())
            c == '-' || c.isDigit() -> number()
            src.startsWith("true", pos) -> { pos += 4; WinnieLit.Bool(true) }
            src.startsWith("false", pos) -> { pos += 5; WinnieLit.Bool(false) }
            src.startsWith("null", pos) -> { pos += 4; WinnieLit.Null }
            else -> fail("unexpected character '$c'")
        }
    }

    private fun array(): WinnieLit {
        pos++ // [
        val items = ArrayList<WinnieLit>()
        skipWhitespace()
        if (pos < src.length && src[pos] == ']') {
            pos++
            return WinnieLit.Arr(items)
        }
        while (true) {
            skipWhitespace()
            items.add(value())
            skipWhitespace()
            if (pos >= src.length) fail("unterminated array")
            when (src[pos]) {
                ',' -> pos++
                ']' -> {
                    pos++
                    return WinnieLit.Arr(items)
                }
                else -> fail("expected ',' or ']'")
            }
        }
    }

    private fun string(): String {
        pos++ // opening quote
        val sb = StringBuilder()
        while (true) {
            if (pos >= src.length) fail("unterminated string")
            val c = src[pos++]
            when (c) {
                '"' -> return sb.toString()
                '\\' -> {
                    if (pos >= src.length) fail("unterminated escape")
                    when (val e = src[pos++]) {
                        '"' -> sb.append('"')
                        '\\' -> sb.append('\\')
                        '/' -> sb.append('/')
                        'b' -> sb.append('\b')
                        'f' -> sb.append('\u000C')
                        'n' -> sb.append('\n')
                        'r' -> sb.append('\r')
                        't' -> sb.append('\t')
                        'u' -> {
                            if (pos + 4 > src.length) fail("bad unicode escape")
                            val code = src.substring(pos, pos + 4).toIntOrNull(16) ?: fail("bad unicode escape")
                            sb.append(code.toChar())
                            pos += 4
                        }
                        else -> fail("bad escape '\\$e'")
                    }
                }
                else -> sb.append(c)
            }
        }
    }

    private fun number(): WinnieLit {
        val start = pos
        if (src[pos] == '-') pos++
        while (pos < src.length && (src[pos].isDigit() || src[pos] in ".eE+-")) pos++
        val text = src.substring(start, pos)
        if (text.toDoubleOrNull() == null) fail("bad number '$text'")
        return WinnieLit.Num(text)
    }
}
