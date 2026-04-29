import type { EditorCursorInfo, SyncState } from "@mei-friend/lib-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../../../context/AppSettingsContext";
import { useFocusedPanel } from "../../../../context/FocusedPanelContext";
import { useMeiFriend } from "../../../../context/MeiFriendRegistryContext";
import { CodeMirrorEditor, type CodeMirrorEditorRef } from "./CodeMirrorEditor";
import styles from "./CodeMirrorPanel.module.css";
import { CodeMirrorPanelFooter } from "./CodeMirrorPanelFooter";
import { CodeMirrorPanelHeader } from "./CodeMirrorPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: string | null;
}

export default function CodeMirrorPanel({ panelId, meiFriendId }: Props) {
  const { setFocusedPanelId } = useFocusedPanel();
  const { navigateEnabled } = useAppSettings();

  const { meiFriend, state, setSelection } = useMeiFriend(meiFriendId);

  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [cursorInfo, setCursorInfo] = useState<EditorCursorInfo | null>(null);
  const editorRef = useRef<CodeMirrorEditorRef>(null);

  const handleClick = useCallback(() => {
    if (meiFriendId) {
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setFocusedPanelId]);

  const handleApply = useCallback(() => {
    editorRef.current?.apply();
  }, []);

  const handleRefresh = useCallback(() => {
    editorRef.current?.refresh();
  }, []);

  const handleStateChange = useCallback((state: SyncState) => {
    setSyncState(state);
  }, []);

  const handleCursorChange = useCallback(
    (info: EditorCursorInfo) => {
      setCursorInfo(info);
      if (meiFriendId && info.xmlId) {
        setSelection(info.xmlId, "codemirror");
      }
    },
    [meiFriendId, setSelection],
  );

  // React to external selection if Navigate is enabled
  useEffect(() => {
    if (navigateEnabled && state) {
      if (state.selectionId) {
        if (state.selectionOrigin !== "codemirror") {
          editorRef.current?.highlightElement(state.selectionId);
          editorRef.current?.navigateTo(state.selectionId);
        } else {
          editorRef.current?.highlightElement(null);
        }
      }
    } else {
      editorRef.current?.highlightElement(null);
    }
  }, [navigateEnabled, state]);

  if (!meiFriendId) {
    return (
      <div className={styles.panel}>
        <div className={styles.welcomeContent}>No file selected</div>
      </div>
    );
  }

  if (!meiFriend || !state) {
    return (
      <div className={styles.panel}>
        <div className={styles.welcomeContent}>
          Loading MEI content for "{meiFriendId}"…
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
