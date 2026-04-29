import { Cursor } from "@mei-friend/core";
import {
  VerovioCanvas,
  type VerovioCanvasHandle,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VerovioOptions } from "verovio";
import { useAppSettings } from "../../../../context/AppSettingsContext";
import { useFocusedPanel } from "../../../../context/FocusedPanelContext";
import { useMeiFriend } from "../../../../context/MeiFriendRegistryContext";
import { useVerovioKeyboard } from "../../../../hooks/useVerovioKeyboard";
import styles from "./VerovioPanel.module.css";
import { VerovioPanelFooter } from "./VerovioPanelFooter";
import { VerovioPanelHeader } from "./VerovioPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: string | null;
}

export default function VerovioPanel({ panelId, meiFriendId }: Props) {
  const { setFocusedPanelId } = useFocusedPanel();
  const { navigateEnabled } = useAppSettings();

  const { meiFriend, state, setSelection, setCursor } =
    useMeiFriend(meiFriendId);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [fitMode, setFitMode] = useState<"off" | "width" | "height">("width");
  const [vrvOptions, setVrvOptions] = useState<VerovioOptions>({
    scale: 50,
    breaks: "auto",
  });
  const verovioCanvasRef = useRef<VerovioCanvasHandle>(null);

  const [verovioHighlightId, setVerovioHighlightId] = useState<string | null>(
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset panel state whenever the file switches
  useEffect(() => {
    setCurrentPage(1);
    setCursor(null);
  }, [meiFriendId, setCursor]);

  // React to external selection if Navigate is enabled
  useEffect(() => {
    if (navigateEnabled && state) {
      if (state.selectionId) {
        if (state.selectionOrigin !== "verovio") {
          setVerovioHighlightId(state.selectionId);
          verovioCanvasRef.current?.scrollToElement(state.selectionId);
        } else {
          setVerovioHighlightId(null);
        }
      }
    } else {
      setVerovioHighlightId(null);
    }
  }, [navigateEnabled, state]);

  const handleSelectionChange = useCallback(
    (id: string | null) => {
      if (meiFriend && id) {
        const newCursor = Cursor.fromId(meiFriend, id);
        if (newCursor) setCursor(newCursor);
      }
      if (meiFriendId) {
        setSelection(id, "verovio");
      }
    },
    [meiFriend, meiFriendId, setSelection, setCursor],
  );

  const handlePanelClick = useCallback(() => {
    if (meiFriendId) {
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setFocusedPanelId]);

  useVerovioKeyboard(panelId);

  if (!meiFriendId) {
    return <div className={styles.placeholder}>No file selected</div>;
  }

  if (!meiFriend || !state) {
    return <div className={styles.placeholder}>Loading "{meiFriendId}"…</div>;
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
          selectedId={state.selectionId}
          highlightId={verovioHighlightId}
          cursor={state.cursor}
          onSelectionChange={handleSelectionChange}
          onTotalPagesChange={setTotalPages}
        />
      </div>
      <VerovioPanelFooter
        cursor={state.cursor}
        selectedId={state.selectionId}
        meiFriend={meiFriend}
      />
    </div>
  );
}
