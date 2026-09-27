import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  moveCompletionSelection,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { collectIdentifiers } from "./identifiers";

const WORD = /[A-Za-z_][A-Za-z0-9_]*/;

/**
 * Completion source that only ever suggests names the user has declared in the
 * current document (see `collectIdentifiers`). Never suggests the exact word
 * being typed, and returns null (closing the popup) when nothing else matches.
 */
export function userCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(WORD);
  if (!word && !context.explicit) return null;

  const typed = word ? word.text : "";
  const from = word ? word.from : context.pos;

  const options: Completion[] = collectIdentifiers(context.state.doc.toString())
    .filter((id) => id.name !== typed && id.name.startsWith(typed))
    .map((id) => ({ label: id.name, type: id.kind }));

  if (options.length === 0) return null;

  return { from, options, validFor: WORD };
}

/**
 * Wires up the "only my own names" autocomplete: opens while typing a matching
 * prefix, Tab accepts (only while the popup is open), Ctrl-Space opens it on
 * demand, arrows navigate and Escape closes it.
 *
 * Enter is deliberately left unbound here. `autocompletion()`'s own keymap
 * (which binds Enter to acceptCompletion) is disabled via `defaultKeymap: false` -
 * the option is a single document-wide facet, so this also switches off any other
 * `autocompletion()` call in the extension tree (e.g. inside `basicSetup`). That
 * leaves the editor's ordinary Enter binding (insert a newline) as the only one,
 * so Enter can never accept a completion, in or out of the popup.
 */
export function userCompletions(): Extension {
  return [
    autocompletion({
      override: [userCompletionSource],
      activateOnTyping: true,
      defaultKeymap: false,
    }),
    Prec.highest(
      keymap.of([
        { key: "Ctrl-Space", run: startCompletion },
        { key: "Escape", run: closeCompletion },
        { key: "ArrowDown", run: moveCompletionSelection(true) },
        { key: "ArrowUp", run: moveCompletionSelection(false) },
        { key: "Tab", run: acceptCompletion },
      ]),
    ),
  ];
}
