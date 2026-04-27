import { Cursor } from "@mei-friend/core";
import {
  VerovioCanvas,
  type VerovioCanvasHandle,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VerovioOptions } from "verovio";
import { useAppState } from "../../../../context/AppStateContext";
import { useWorkspace } from "../../../../context/WorkspaceContext";
import { useVerovioKeyboard } from "../../../../hooks/useVerovioKeyboard";
import styles from "./VerovioPanel.module.css";
import { VerovioPanelFooter } from "./VerovioPanelFooter";
import { VerovioPanelHeader } from "./VerovioPanelHeader";

interface Props {
  panelId: string;
  meiFriendId: string | null;
}

export default function VerovioPanel({ panelId, meiFriendId }: Props) {
  const { workspace } = useWorkspace();
  const { setActiveMeiFriendPath, setActiveSelectedId, setFocusedPanelId } =
    useAppState();

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
    if (meiFriendId) {
      setActiveMeiFriendPath(meiFriendId);
      setFocusedPanelId(panelId);
    }
  }, [meiFriendId, panelId, setActiveMeiFriendPath, setFocusedPanelId]);

  useVerovioKeyboard(panelId, meiFriendId, cursor, setCursor, setSelectedId);

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
