import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import type { MeiFriend } from "@mei-friend/core";
import {
  CodeMirrorPlugin,
  type EditorCursorInfo,
  type SyncState,
} from "@mei-friend/lib-codemirror";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import styles from "./CodeMirrorEditor.module.css";

// Custom basic setup without history() — history is provided by CodeMirrorPlugin.
const customSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
    indentWithTab,
  ]),
];

interface Props {
  meiFriend: MeiFriend;
  origin?: string;
  onStateChange?: (state: SyncState) => void;
  onCursorChange?: (info: EditorCursorInfo) => void;
}

export interface CodeMirrorEditorRef {
  refresh: () => void;
  apply: () => boolean;
  navigateTo: (xmlId: string) => boolean;
  highlightElement: (xmlId: string | null) => boolean;
  get isDirty(): boolean;
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, Props>(
  ({ meiFriend, origin, onStateChange, onCursorChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pluginRef = useRef<CodeMirrorPlugin | null>(null);

    // Keep callback refs up to date on every render so the plugin always calls
    // the latest version without needing to recreate the editor.
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;
    const onCursorChangeRef = useRef(onCursorChange);
    onCursorChangeRef.current = onCursorChange;

    useImperativeHandle(ref, () => ({
      refresh: () => {
        pluginRef.current?.refresh();
      },
      apply: () => pluginRef.current?.apply() ?? false,
      navigateTo: (xmlId) => pluginRef.current?.scrollToElement(xmlId) ?? false,
      highlightElement: (xmlId) =>
        pluginRef.current?.highlightElement(xmlId) ?? false,
      get isDirty() {
        return pluginRef.current?.isDirty ?? false;
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const plugin = new CodeMirrorPlugin(meiFriend, {
        origin,
        onStateChange: (state) => onStateChangeRef.current?.(state),
        onCursorChange: (info) => onCursorChangeRef.current?.(info),
      });
      pluginRef.current = plugin;

      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [customSetup, plugin.extensions],
        parent: containerRef.current,
      });

      return () => {
        view.destroy();
        plugin.destroy();
        pluginRef.current = null;
      };
    }, [meiFriend, origin]);

    return <div ref={containerRef} className={styles.editorContainer} />;
  },
);
