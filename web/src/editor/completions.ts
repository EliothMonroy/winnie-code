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
 * prefix, Tab or Enter accepts (only while the popup is open), Ctrl-Space opens
 * it on demand, arrows navigate and Escape closes it.
 *
 * `autocompletion()`'s own keymap is disabled via `defaultKeymap: false` (a single
 * document-wide facet, so this also switches off the one inside `basicSetup`) and
 * replaced by the bindings below. `acceptCompletion` returns false when no popup is
 * open, so Tab and Enter fall through to indenting and inserting a newline. Because
 * the popup hides once the typed word exactly matches a name, Enter after a fully
 * typed name still inserts a newline.
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
        { key: "Enter", run: acceptCompletion },
      ]),
    ),
  ];
}
