import type { EditorCursorInfo, SyncState } from "@mei-friend/lib-codemirror";
import { useCallback, useRef, useState } from "react";
import { useAppState } from "../../../../context/AppStateContext";
import { useWorkspace } from "../../../../context/WorkspaceContext";
import { CodeMirrorEditor, type CodeMirrorEditorRef } from "./CodeMirrorEditor";
import styles from "./CodeMirrorPanel.module.css";
import { CodeMirrorPanelFooter } from "./CodeMirrorPanelFooter";
import { CodeMirrorPanelHeader } from "./CodeMirrorPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: string | null;
}

export default function CodeMirrorPanel({ panelId, meiFriendId }: Props) {
  const { workspace } = useWorkspace();
  const { setActiveMeiFriendPath, setFocusedPanelId } = useAppState();

  const meiFriend = meiFriendId ? workspace.getMeiFriend(meiFriendId) : null;

  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [cursorInfo, setCursorInfo] = useState<EditorCursorInfo | null>(null);
  const editorRef = useRef<CodeMirrorEditorRef>(null);

  const handleClick = useCallback(() => {
    if (meiFriendId) {
      setActiveMeiFriendPath(meiFriendId);
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setActiveMeiFriendPath, setFocusedPanelId]);

  const handleApply = useCallback(() => {
    editorRef.current?.apply();
  }, []);

  const handleRefresh = useCallback(() => {
    editorRef.current?.refresh();
  }, []);

  const handleStateChange = useCallback((state: SyncState) => {
    setSyncState(state);
  }, []);

  const handleCursorChange = useCallback((info: EditorCursorInfo) => {
    setCursorInfo(info);
  }, []);

  if (!meiFriend) {
    return (
      <div className={styles.panel}>
        <div className={styles.welcomeContent}>
          {meiFriendId
            ? `No MEI content loaded for "${meiFriendId}"`
            : "No file selected"}
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: panel focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: panel focus
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--backgroundColor)",
      }}
      onClick={handleClick}
    >
      <CodeMirrorPanelHeader
        syncState={syncState}
        onApply={handleApply}
        onRefresh={handleRefresh}
      />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <CodeMirrorEditor
          ref={editorRef}
          meiFriend={meiFriend}
          origin="codemirror"
          onStateChange={handleStateChange}
          onCursorChange={handleCursorChange}
        />
      </div>
      <CodeMirrorPanelFooter cursorInfo={cursorInfo} />
    </div>
  );
}
