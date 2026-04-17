import type { MeiFriend } from "@mei-friend/core";
import { CodeMirrorPlugin, type SyncState } from "@mei-friend/lib-codemirror";
import { basicSetup, EditorView } from "codemirror";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import styles from "./CodeMirrorEditor.module.css";

interface Props {
  meiFriend: MeiFriend;
  origin?: string;
  onStateChange?: (state: SyncState) => void;
}

export interface CodeMirrorEditorRef {
  refresh: () => void;
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, Props>(
  ({ meiFriend, origin, onStateChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pluginRef = useRef<CodeMirrorPlugin | null>(null);

    useImperativeHandle(ref, () => ({
      refresh: () => {
        pluginRef.current?.refresh();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const plugin = new CodeMirrorPlugin(meiFriend, {
        origin: origin,
        onStateChange: onStateChange,
      });
      pluginRef.current = plugin;

      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
        parent: containerRef.current,
      });

      return () => {
        view.destroy();
        plugin.destroy();
        pluginRef.current = null;
      };
    }, [meiFriend, origin, onStateChange]);

    return <div ref={containerRef} className={styles.editorContainer} />;
  },
);
