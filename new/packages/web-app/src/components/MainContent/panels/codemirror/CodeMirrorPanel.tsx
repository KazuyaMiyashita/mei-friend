import type { EditorCursorInfo, SyncState } from "@mei-friend/lib-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getLocationKey,
  type MeiFriendLocation,
  useFocus,
  useFocusedMeiFriend,
  useMeiFriend,
} from "../../../../context/FocusContext";
import { CodeMirrorEditor, type CodeMirrorEditorRef } from "./CodeMirrorEditor";
import styles from "./CodeMirrorPanel.module.css";
import { CodeMirrorPanelFooter } from "./CodeMirrorPanelFooter";
import { CodeMirrorPanelHeader } from "./CodeMirrorPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: MeiFriendLocation | null;
}

export default function CodeMirrorPanel({ panelId, meiFriendId }: Props) {
  const { setFocusedLocation, setFocusedPanelId, selections, navigateEnabled } =
    useFocus();
  const { setFocusedSelectionId } = useFocusedMeiFriend();

  const meiFriend = useMeiFriend(meiFriendId);

  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [cursorInfo, setCursorInfo] = useState<EditorCursorInfo | null>(null);
  const editorRef = useRef<CodeMirrorEditorRef>(null);

  const selectionState = useMemo(() => {
    if (!meiFriendId) return { selectionId: null, origin: null };
    return (
      selections[getLocationKey(meiFriendId)] ?? {
        selectionId: null,
        origin: null,
      }
    );
  }, [meiFriendId, selections]);

  const handleClick = useCallback(() => {
    if (meiFriendId) {
      setFocusedLocation(meiFriendId);
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setFocusedLocation, setFocusedPanelId]);

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
        setFocusedLocation(meiFriendId);
        setFocusedSelectionId(info.xmlId, "codemirror");
      }
    },
    [meiFriendId, setFocusedLocation, setFocusedSelectionId],
  );

  // React to external selection if Navigate is enabled
  useEffect(() => {
    if (navigateEnabled) {
      if (selectionState.selectionId) {
        if (selectionState.origin !== "codemirror") {
          editorRef.current?.highlightElement(selectionState.selectionId);
          editorRef.current?.navigateTo(selectionState.selectionId);
        } else {
          editorRef.current?.highlightElement(null);
        }
      }
    } else {
      editorRef.current?.highlightElement(null);
    }
  }, [navigateEnabled, selectionState]);

  if (!meiFriendId) {
    return (
      <div className={styles.panel}>
        <div className={styles.welcomeContent}>No file selected</div>
      </div>
    );
  }

  if (!meiFriend) {
    return (
      <div className={styles.panel}>
        <div className={styles.welcomeContent}>
          Loading MEI content for "{meiFriendId.id}"…
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
