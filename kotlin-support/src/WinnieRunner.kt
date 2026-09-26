import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.io.PrintStream
import java.util.Base64
import kotlin.system.exitProcess

/**
 * Runs every test case and prints one tagged line per case on the real stdout:
 *   token|index|status|elapsedMs|b64(output)|b64(normalizedExpected)|b64(capturedStdout)|b64(error)
 * status is "ok" or "error". User println output is captured per case so it never mixes with results.
 */
object WinnieRunner {
    private const val CAPTURE_LIMIT = 64 * 1024
    private const val STACK_SIZE = 256L * 1024 * 1024

    /** Set from the worker's uncaught-exception handler if it dies outside the per-case try (e.g. an OOM). */
    @Volatile
    private var failed = false

    fun run(args: Array<String>, normalizeExpected: (String) -> String, invoke: (List<String>) -> String) {
        val decoder = Base64.getDecoder()
        val cases = File(args[0]).readLines().filter { it.isNotBlank() }.map { line ->
            line.split(" ").map { String(decoder.decode(it), Charsets.UTF_8) }
        }
        val token = args[1]
        val realOut = System.out
        val realErr = System.err

        val worker = Thread(null, {
            cases.forEachIndexed { index, fields ->
                val capture = CappedStream(CAPTURE_LIMIT)
                val captureStream = PrintStream(capture, true, "UTF-8")
                var status = "ok"
                var output = ""
                var expected = ""
                var error = ""
                var elapsedMs = 0L
                try {
                    expected = normalizeExpected(fields.last())
                } catch (t: Throwable) {
                    status = "error"
                    error = "Invalid expected value in problem.json: ${t.message}"
                }
                if (status == "ok") {
                    val start = System.nanoTime()
                    try {
                        System.setOut(captureStream)
                        System.setErr(captureStream)
                        output = invoke(fields.dropLast(1))
                    } catch (t: Throwable) {
                        status = "error"
                        error = describe(t)
                    } finally {
                        System.setOut(realOut)
                        System.setErr(realErr)
                        elapsedMs = (System.nanoTime() - start) / 1_000_000
                    }
                }
                captureStream.flush()
                realOut.println(
                    listOf(token, index.toString(), status, elapsedMs.toString(), b64(output), b64(expected), b64(capture.text()), b64(error))
                        .joinToString("|"),
                )
                realOut.flush()
            }
        }, "winnie-main", STACK_SIZE)
        worker.setUncaughtExceptionHandler { _, t ->
            failed = true
            t.printStackTrace()
        }
        worker.start()
        worker.join()
        exitProcess(if (failed) 1 else 0)
    }

    private fun b64(s: String): String = Base64.getEncoder().encodeToString(s.toByteArray(Charsets.UTF_8))

    private fun describe(t: Throwable): String {
        val frames = t.stackTrace.filter { it.fileName == "Solution.kt" }.ifEmpty { t.stackTrace.take(5) }
        val sb = StringBuilder(t.toString())
        for (frame in frames.take(20)) sb.append("\n    at ").append(frame)
        return sb.toString()
    }
}

private class CappedStream(private val limit: Int) : OutputStream() {
    private val buffer = ByteArrayOutputStream()
    private var truncated = false

    override fun write(b: Int) {
        if (buffer.size() < limit) buffer.write(b) else truncated = true
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        val room = limit - buffer.size()
        if (len <= room) {
            buffer.write(b, off, len)
        } else {
            if (room > 0) buffer.write(b, off, room)
            truncated = true
        }
    }

    fun text(): String {
        val text = String(buffer.toByteArray(), Charsets.UTF_8)
        return if (truncated) "$text\n… output truncated (64 KB limit)" else text
    }
}
