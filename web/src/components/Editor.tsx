import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { Compartment, EditorState, Prec, type Extension, type Text } from "@codemirror/state";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import type { Diagnostic } from "../../../shared/api";

export type EditorHandle = { setValue(code: string): void };

type Props = {
  /** Only read on mount. Remount (key) the editor to load different content. */
  initialValue: string;
  dark: boolean;
  diagnostics: Diagnostic[];
  onChange(code: string): void;
  onRun(): void;
  ref?: Ref<EditorHandle>;
};

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13.5px", backgroundColor: "var(--editor-bg)", color: "var(--text)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "var(--editor-bg)", color: "var(--text-faint)", border: "none" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)", color: "var(--text-muted)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" },
});

function themeExtension(dark: boolean): Extension {
  return dark ? [EditorView.darkTheme.of(true), syntaxHighlighting(oneDarkHighlightStyle)] : [];
}

function toCmDiagnostic(doc: Text, d: Diagnostic): CmDiagnostic {
  const line = doc.line(Math.min(Math.max(d.line, 1), doc.lines));
  const from = Math.min(line.from + Math.max(d.column - 1, 0), line.to);
  const word = /^[\w$]+/.exec(doc.sliceString(from, line.to));
  const to = word ? from + word[0].length : Math.min(from + 1, line.to);
  return { from, to, severity: d.severity, message: d.message };
}

export function Editor({ initialValue, dark, diagnostics, onChange, onRun, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const theme = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  callbacks.current.onRun();
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          StreamLanguage.define(kotlin),
          lintGutter(),
          baseTheme,
          theme.current.of(themeExtension(dark)),
          EditorView.contentAttributes.of({ "aria-label": "Kotlin code editor" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once per mount; initialValue/dark changes are handled below or by remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: theme.current.reconfigure(themeExtension(dark)) });
  }, [dark]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(setDiagnostics(editor.state, diagnostics.map((d) => toCmDiagnostic(editor.state.doc, d))));
  }, [diagnostics]);

  useImperativeHandle(
    ref,
    () => ({
      setValue(code: string) {
        const editor = view.current;
        if (editor) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } });
      },
    }),
    [],
  );

  return <div className="editor" ref={host} />;
}
