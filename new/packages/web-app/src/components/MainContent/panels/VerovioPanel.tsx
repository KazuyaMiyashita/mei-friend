import { Cursor } from "@mei-friend/core";
import {
  VerovioCanvas,
  type VerovioCanvasHandle,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VerovioOptions } from "verovio";
import { useAppState, useWorkspace } from "../../../context/AppStateContext";
import styles from "./VerovioPanel.module.css";
import { VerovioPanelFooter } from "./VerovioPanelFooter";
import { VerovioPanelHeader } from "./VerovioPanelHeader";

interface Props {
  meiFriendId: string | null;
}

export default function VerovioPanel({ meiFriendId }: Props) {
  const { workspace } = useWorkspace();
  const { setActiveMeiFriendPath, setActiveSelectedId } = useAppState();

  const meiFriend = meiFriendId ? workspace.getMeiFriend(meiFriendId) : null;

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [fitMode, setFitMode] = useState<"off" | "width" | "height">("height");
  const [vrvOptions, setVrvOptions] = useState<VerovioOptions>({
    scale: 50,
    breaks: "auto",
  });
  const verovioCanvasRef = useRef<VerovioCanvasHandle>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset panel state whenever the meiFriend instance changes (file switch)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedId(null);
    setCursor(null);
  }, [meiFriend]);

  const handleSelectionChange = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (meiFriend && id) {
        const newCursor = Cursor.fromId(meiFriend, id);
        if (newCursor) setCursor(newCursor);
      }
      if (meiFriendId) {
        setActiveMeiFriendPath(meiFriendId);
        setActiveSelectedId(id);
      }
    },
    [meiFriend, meiFriendId, setActiveMeiFriendPath, setActiveSelectedId],
  );

  const handlePanelClick = useCallback(() => {
    if (meiFriendId) setActiveMeiFriendPath(meiFriendId);
  }, [meiFriendId, setActiveMeiFriendPath]);

  // Cursor keyboard navigation when panel is focused
  const panelRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const onFocusIn = () => {
      isFocused.current = true;
    };
    const onFocusOut = () => {
      isFocused.current = false;
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused.current || !cursor) return;

      let nextCursor: Cursor | undefined;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextCursor = e.shiftKey ? cursor.nextBeat() : cursor.nextEvent();
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextCursor = e.shiftKey ? cursor.prevBeat() : cursor.prevEvent();
          break;
        case "ArrowUp":
          e.preventDefault();
          nextCursor = e.shiftKey
            ? cursor.staffUp().snapToBeat()
            : cursor.staffUp().snapToEvent();
          break;
        case "ArrowDown":
          e.preventDefault();
          nextCursor = e.shiftKey
            ? cursor.staffDown().snapToBeat()
            : cursor.staffDown().snapToEvent();
          break;
      }

      if (nextCursor && nextCursor !== cursor) {
        setCursor(nextCursor);
        const eventId = nextCursor.getEvent()?.id ?? null;
        setSelectedId(eventId);
        if (meiFriendId && eventId !== undefined) {
          setActiveSelectedId(eventId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [cursor, meiFriendId, setActiveSelectedId]);

  if (!meiFriend) {
    return (
      <div className={styles.placeholder}>
        {meiFriendId ? `Loading "${meiFriendId}"…` : "No file selected"}
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: panel focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: panel focus
    <div ref={panelRef} className={styles.panel} onClick={handlePanelClick}>
      <VerovioPanelHeader
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        fitMode={fitMode}
        setFitMode={setFitMode}
        vrvOptions={vrvOptions}
        setVrvOptions={setVrvOptions}
        enabled={!!meiFriend}
      />
      <div className={styles.canvasWrapper}>
        <VerovioCanvas
          ref={verovioCanvasRef}
          meiFriend={meiFriend}
          options={vrvOptions}
          currentPage={currentPage}
          fitMode={fitMode}
          selectedId={selectedId}
          cursor={cursor}
          onSelectionChange={handleSelectionChange}
          onTotalPagesChange={setTotalPages}
        />
      </div>
      <VerovioPanelFooter
        cursor={cursor}
        selectedId={selectedId}
        meiFriend={meiFriend}
      />
    </div>
  );
}
