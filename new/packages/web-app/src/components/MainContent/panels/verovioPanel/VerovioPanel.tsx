import { Cursor } from "@mei-friend/core";
import {
  VerovioCanvas,
  type VerovioCanvasHandle,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VerovioOptions } from "verovio";
import {
  getLocationKey,
  type MeiFriendLocation,
  useFocus,
  useFocusedMeiFriend,
  useMeiFriend,
} from "../../../../context/FocusContext";
import { useVerovioKeyboard } from "../../../../hooks/useVerovioKeyboard";
import styles from "./VerovioPanel.module.css";
import { VerovioPanelFooter } from "./VerovioPanelFooter";
import { VerovioPanelHeader } from "./VerovioPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: MeiFriendLocation | null;
}

export default function VerovioPanel({ panelId, meiFriendId }: Props) {
  const { setFocusedLocation, setFocusedPanelId, selections, navigateEnabled } =
    useFocus();
  const { setFocusedSelectionId } = useFocusedMeiFriend();

  const meiFriend = useMeiFriend(meiFriendId);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const selectionState = useMemo(() => {
    if (!meiFriendId) return { selectionId: null, origin: null };
    return (
      selections[getLocationKey(meiFriendId)] ?? {
        selectionId: null,
        origin: null,
      }
    );
  }, [meiFriendId, selections]);

  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [fitMode, setFitMode] = useState<"off" | "width" | "height">("width");
  const [vrvOptions, setVrvOptions] = useState<VerovioOptions>({
    scale: 50,
    breaks: "auto",
  });
  const verovioCanvasRef = useRef<VerovioCanvasHandle>(null);

  const [verovioHighlightId, setVerovioHighlightId] = useState<string | null>(
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset panel state whenever the meiFriend instance changes (file switch)
  useEffect(() => {
    setCurrentPage(1);
    setCursor(null);
  }, [meiFriend]);

  // React to external selection if Navigate is enabled
  useEffect(() => {
    if (navigateEnabled) {
      if (selectionState.selectionId) {
        if (selectionState.origin !== "verovio") {
          setVerovioHighlightId(selectionState.selectionId);
          verovioCanvasRef.current?.scrollToElement(selectionState.selectionId);
        } else {
          setVerovioHighlightId(null);
        }
      }
    } else {
      setVerovioHighlightId(null);
    }
  }, [navigateEnabled, selectionState]);

  const handleSelectionChange = useCallback(
    (id: string | null) => {
      if (meiFriend && id) {
        const newCursor = Cursor.fromId(meiFriend, id);
        if (newCursor) setCursor(newCursor);
      }
      if (meiFriendId) {
        setFocusedLocation(meiFriendId);
        setFocusedSelectionId(id, "verovio");
      }
    },
    [meiFriend, meiFriendId, setFocusedLocation, setFocusedSelectionId],
  );

  const handlePanelClick = useCallback(() => {
    if (meiFriendId) {
      setFocusedLocation(meiFriendId);
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setFocusedLocation, setFocusedPanelId]);

  useVerovioKeyboard(panelId, meiFriendId, cursor, setCursor, (id) => {
    if (meiFriendId) setFocusedSelectionId(id, "verovio");
  });

  if (!meiFriendId) {
    return <div className={styles.placeholder}>No file selected</div>;
  }

  if (!meiFriend) {
    return (
      <div className={styles.placeholder}>Loading "{meiFriendId.id}"…</div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: panel focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: panel focus
    <div className={styles.panel} onClick={handlePanelClick}>
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
          selectedId={selectionState.selectionId}
          highlightId={verovioHighlightId}
          cursor={cursor}
          onSelectionChange={handleSelectionChange}
          onTotalPagesChange={setTotalPages}
        />
      </div>
      <VerovioPanelFooter
        cursor={cursor}
        selectedId={selectionState.selectionId}
        meiFriend={meiFriend}
      />
    </div>
  );
}
