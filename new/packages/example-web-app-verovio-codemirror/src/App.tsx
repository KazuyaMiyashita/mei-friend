import { Cursor, MeiFriend } from "@mei-friend/core";
import type { EditorCursorInfo, SyncState } from "@mei-friend/lib-codemirror";
import {
  VerovioCanvas,
  type VerovioCanvasHandle,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import type { VerovioOptions } from "verovio";
import styles from "./App.module.css";
import {
  CodeMirrorEditor,
  type CodeMirrorEditorRef,
} from "./components/CodeMirrorEditor";
import { CodeMirrorEditorFooter } from "./components/CodeMirrorEditorFooter";
import { VerovioCanvasFooter } from "./components/VerovioCanvasFooter";

interface LogEntry {
  id: number;
  timestamp: Date;
  origin: string;
  targetId: string;
  details: string;
  rawEvent: Record<string, unknown>;
}

export default function App() {
  const [meiFriend, setMeiFriend] = useState<MeiFriend | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");

  const [vrvOptions] = useState<VerovioOptions>({
    scale: 50,
    breaks: "none",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [editorCursorInfo, setEditorCursorInfo] =
    useState<EditorCursorInfo | null>(null);
  const editorRef = useRef<CodeMirrorEditorRef>(null);
  const verovioCanvasRef = useRef<VerovioCanvasHandle>(null);

  // Verovio panel: ID input + highlight/navigate checkboxes
  const [verovioInputId, setVerovioInputId] = useState("");
  const [verovioHighlightId, setVerovioHighlightId] = useState<string | null>(
    null,
  );
  const [verovioHighlight, setVerovioHighlight] = useState(false);
  const [verovioNavigate, setVerovioNavigate] = useState(false);

  // CodeMirror panel: ID input + highlight/navigate checkboxes
  const [cmInputId, setCmInputId] = useState("");
  const [cmHighlight, setCmHighlight] = useState(false);
  const [cmNavigate, setCmNavigate] = useState(false);

  // ── Action refs ──────────────────────────────────────────────────────────
  // Updated on every render so event handlers always call the latest closure
  // without needing them in dependency arrays (avoids stale state & re-renders).

  const applyCmActionsRef = useRef<(id: string) => void>(() => {});
  applyCmActionsRef.current = (id: string) => {
    if (!id) {
      editorRef.current?.highlightElement(null);
      return;
    }
    if (cmHighlight) editorRef.current?.highlightElement(id);
    if (cmNavigate) editorRef.current?.navigateTo(id);
  };

  const applyVerovioActionsRef = useRef<(id: string) => void>(() => {});
  applyVerovioActionsRef.current = (id: string) => {
    if (!id) {
      setVerovioHighlightId(null);
      return;
    }
    if (verovioHighlight) setVerovioHighlightId(id);
    if (verovioNavigate) verovioCanvasRef.current?.scrollToElement(id);
  };

  // Tracks the last xmlId propagated from CM to Verovio, to skip redundant
  // cross-panel updates when the cursor stays within the same element.
  const prevCmXmlIdRef = useRef<string | undefined>(undefined);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const logIdRef = useRef(0);

  // Tracks whether the Verovio panel has focus
  const verovioPanelRef = useRef<HTMLElement>(null);
  const verovioFocused = useRef(false);

  // Track focus via document-level focusin — avoids putting event handlers on static elements
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      verovioFocused.current =
        verovioPanelRef.current?.contains(e.target as Node) ?? false;
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, []);

  const handleSelectionChange = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      // Clicking the score canvas doesn't fire focusin (canvas is not focusable),
      // so set verovioFocused explicitly here.
      verovioFocused.current = true;
      if (meiFriend && id) {
        const newCursor = Cursor.fromId(meiFriend, id);
        if (newCursor) setCursor(newCursor);
      }
      // Cross-panel: propagate Verovio selection → CodeMirror
      if (id) {
        setCmInputId(id);
        applyCmActionsRef.current(id);
      }
    },
    [meiFriend],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const text = await file.text();
        const instance = MeiFriend.fromXmlString(text);
        const title = instance.api.getTitle() || "";
        setMeiFriend(instance);
        setCurrentTitle(title);
        setCurrentPage(1);
        setSelectedId(null);
        setCursor(null);
        setLogs([]);
        setSelectedLogId(null);
        // Reset cross-panel state
        setCmInputId("");
        setVerovioInputId("");
        setVerovioHighlightId(null);
        prevCmXmlIdRef.current = undefined;
      }
    },
    [],
  );

  useEffect(() => {
    if (!meiFriend) return;
    const unregister = meiFriend.onUpdate((events) => {
      setCurrentTitle(meiFriend.api.getTitle() || "");
      setLogs((prev) => {
        const newLogs = events.map((e) => {
          logIdRef.current += 1;
          return {
            id: logIdRef.current,
            timestamp: new Date(),
            origin: String(e.origin || "unknown"),
            targetId: e.xmlId,
            details: `Updated: ${e.xmlString.substring(0, 60)}...`,
            rawEvent: {
              origin: e.origin,
              isLocal: e.isLocal,
              xmlId: e.xmlId,
              xmlString: e.xmlString,
            },
          };
        });
        return [...newLogs, ...prev].slice(0, 100);
      });
    });
    return () => unregister();
  }, [meiFriend]);

  // Keyboard navigation — only active when Verovio panel is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!verovioFocused.current) return;
      if (!cursor || !meiFriend) return;

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
          if (e.ctrlKey) {
            e.preventDefault();
            if (selectedId) {
              try {
                const result = meiFriend.api.editor.pitchUp(selectedId);
                meiFriend.updateBatch([
                  result.note,
                  ...result.accidentalCorrections.map((c) => c.element),
                ]);
              } catch {
                // non-note elements ignored
              }
            }
            return;
          }
          e.preventDefault();
          nextCursor = e.shiftKey
            ? cursor.staffUp().snapToBeat()
            : cursor.staffUp().snapToEvent();
          break;
        case "ArrowDown":
          if (e.ctrlKey) {
            e.preventDefault();
            if (selectedId) {
              try {
                const result = meiFriend.api.editor.pitchDown(selectedId);
                meiFriend.updateBatch([
                  result.note,
                  ...result.accidentalCorrections.map((c) => c.element),
                ]);
              } catch {
                // non-note elements ignored
              }
            }
            return;
          }
          e.preventDefault();
          nextCursor = e.shiftKey
            ? cursor.staffDown().snapToBeat()
            : cursor.staffDown().snapToEvent();
          break;
      }

      if (nextCursor && nextCursor !== cursor) {
        setCursor(nextCursor);
        setSelectedId(nextCursor.getEvent()?.id ?? null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [cursor, meiFriend, selectedId]);

  const renderStatusIndicator = (state: SyncState) => {
    if (state.status === "idle") return null;
    return (
      <>
        <span className={styles.dirtyDot} />
        {state.status === "invalid" && (
          <span className={styles.invalidBadge} title={state.error}>
            invalid{state.error ? `: ${state.error}` : ""}
          </span>
        )}
      </>
    );
  };

  // Go button / Enter handlers delegate to the action refs so they always
  // use the latest checkbox state without needing it in their dep arrays.
  const handleCmApply = useCallback(() => {
    applyCmActionsRef.current(cmInputId);
  }, [cmInputId]);

  const handleVerovioApply = useCallback(() => {
    applyVerovioActionsRef.current(verovioInputId);
  }, [verovioInputId]);

  // Cross-panel: CM cursor change → Verovio.
  // Only propagates when the enclosing xml:id actually changes to a new value,
  // preventing redundant updates while the cursor stays within the same element.
  // navigateTo() uses scroll-only (no cursor move), so this handler is never
  // triggered by programmatic cross-panel navigation — no feedback loop.
  const handleEditorCursorChange = useCallback((info: EditorCursorInfo) => {
    setEditorCursorInfo(info);
    if (info.xmlId && info.xmlId !== prevCmXmlIdRef.current) {
      prevCmXmlIdRef.current = info.xmlId;
      setVerovioInputId(info.xmlId);
      applyVerovioActionsRef.current(info.xmlId);
    }
  }, []);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
    setSelectedLogId(null);
  }, []);

  const toggleLogDetails = useCallback((id: number) => {
    setSelectedLogId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Verovio + CodeMirror</h1>
        <label className={styles.headerFileLabel}>
          <span className={styles.headerFileLabelText}>MEI File</span>
          <input
            type="file"
            accept=".mei,.xml"
            onChange={handleFileChange}
            className={styles.headerFileInput}
          />
        </label>
        {currentTitle && (
          <span className={styles.headerTitle} title={currentTitle}>
            {currentTitle}
          </span>
        )}
      </header>

      <PanelGroup orientation="vertical" className={styles.verticalGroup}>
        {/* ── Main horizontal panels ── */}
        <Panel defaultSize="78%" minSize="30%">
          <PanelGroup orientation="horizontal" className={styles.mainGroup}>
            <Panel defaultSize="50%" minSize="20%">
              <section
                ref={verovioPanelRef}
                aria-label="Verovio score viewer"
                className={styles.verovioPanel}
              >
                <div className={styles.panelHeader}>
                  <div
                    className={`${styles.panelHeaderRow1} ${styles.verovioHeaderRow1}`}
                  >
                    <h3>Verovio</h3>
                    <div className={styles.pageNavCenter}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={!meiFriend || currentPage <= 1}
                      >
                        &lt;
                      </button>
                      <span className={styles.pageCount}>
                        {meiFriend ? `${currentPage} / ${totalPages}` : "- / -"}
                      </span>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={!meiFriend || currentPage >= totalPages}
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                  <div className={styles.panelHeaderRow2}>
                    <input
                      type="text"
                      placeholder="xml:id"
                      value={verovioInputId}
                      onChange={(e) => setVerovioInputId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleVerovioApply();
                      }}
                      className={styles.headerIdInput}
                      disabled={!meiFriend}
                    />
                    <button
                      type="button"
                      className={styles.goBtn}
                      onClick={handleVerovioApply}
                      disabled={!meiFriend}
                    >
                      Go
                    </button>
                    <label className={styles.headerCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={verovioHighlight}
                        onChange={(e) => setVerovioHighlight(e.target.checked)}
                        disabled={!meiFriend}
                      />
                      Highlight
                    </label>
                    <label className={styles.headerCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={verovioNavigate}
                        onChange={(e) => setVerovioNavigate(e.target.checked)}
                        disabled={!meiFriend}
                      />
                      Navigate
                    </label>
                  </div>
                </div>

                <div className={styles.verovioCanvasWrapper}>
                  {meiFriend ? (
                    <VerovioCanvas
                      ref={verovioCanvasRef}
                      meiFriend={meiFriend}
                      options={vrvOptions}
                      currentPage={currentPage}
                      fitMode="height"
                      selectedId={selectedId}
                      highlightId={verovioHighlightId}
                      cursor={cursor}
                      debugFilters={{ staff: false, note: false, caret: false }}
                      onSelectionChange={handleSelectionChange}
                      onTotalPagesChange={setTotalPages}
                    />
                  ) : (
                    <div className={styles.placeholder}>
                      Open an MEI file to display the score
                    </div>
                  )}
                </div>

                <VerovioCanvasFooter
                  cursor={cursor}
                  selectedId={selectedId}
                  meiFriend={meiFriend}
                  enabled={!!meiFriend}
                />
              </section>
            </Panel>

            <PanelResizeHandle className={styles.resizeHandle} />

            <Panel defaultSize="50%" minSize="20%">
              <div className={styles.codeMirrorPanel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeaderRow1}>
                    <div className={styles.panelHeaderLeft}>
                      <h3>CodeMirror</h3>
                      {renderStatusIndicator(syncState)}
                    </div>
                    <div className={styles.panelHeaderRight}>
                      <button
                        className={styles.applyBtn}
                        onClick={() => editorRef.current?.apply()}
                        title="Apply changes to model (Cmd+Enter)"
                        type="button"
                        disabled={!meiFriend || syncState.status !== "dirty"}
                      >
                        Apply
                      </button>
                      <span className={styles.applyShortcut}>⌘↵</span>
                      <span className={styles.headerDivider} />
                      <button
                        className={styles.refreshBtn}
                        onClick={() => editorRef.current?.refresh()}
                        title="Overwrite from MeiFriend Model"
                        type="button"
                        disabled={!meiFriend || syncState.status === "idle"}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className={styles.panelHeaderRow2}>
                    <input
                      type="text"
                      placeholder="xml:id"
                      value={cmInputId}
                      onChange={(e) => setCmInputId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCmApply();
                      }}
                      className={styles.headerIdInput}
                      disabled={!meiFriend}
                    />
                    <button
                      type="button"
                      className={styles.goBtn}
                      onClick={handleCmApply}
                      disabled={!meiFriend}
                    >
                      Go
                    </button>
                    <label className={styles.headerCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={cmHighlight}
                        onChange={(e) => setCmHighlight(e.target.checked)}
                        disabled={!meiFriend}
                      />
                      Highlight
                    </label>
                    <label className={styles.headerCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={cmNavigate}
                        onChange={(e) => setCmNavigate(e.target.checked)}
                        disabled={!meiFriend}
                      />
                      Navigate
                    </label>
                  </div>
                </div>

                <div className={styles.editorWrapper}>
                  {meiFriend ? (
                    <CodeMirrorEditor
                      ref={editorRef}
                      meiFriend={meiFriend}
                      origin="codemirror"
                      onStateChange={setSyncState}
                      onCursorChange={handleEditorCursorChange}
                    />
                  ) : (
                    <div className={styles.editorPlaceholder}>
                      Open an MEI file to display the editor
                    </div>
                  )}
                </div>

                <CodeMirrorEditorFooter
                  cursorInfo={editorCursorInfo}
                  enabled={!!meiFriend}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* ── Horizontal resize handle ── */}
        <PanelResizeHandle className={styles.resizeHandleH} />

        {/* ── Log panel ── */}
        <Panel defaultSize="22%" minSize="5%" maxSize="60%">
          <div className={styles.logPanel}>
            <div className={styles.logHeader}>
              <h2>Update Events</h2>
              <button
                className={styles.clearBtn}
                onClick={handleClearLogs}
                type="button"
              >
                Clear Logs
              </button>
            </div>
            <div className={styles.logContainer}>
              {logs.length === 0 ? (
                <div style={{ color: "#999", padding: "0.5rem" }}>
                  No events yet. Try editing the XML in the editor.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={styles.logEntryWrapper}>
                    <button
                      type="button"
                      className={`${styles.logEntry} ${selectedLogId === log.id ? styles.selectedLog : ""}`}
                      onClick={() => toggleLogDetails(log.id)}
                    >
                      <span className={styles.logTime}>
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={styles.logOrigin}>[{log.origin}]</span>
                      <span className={styles.logTarget}>{log.targetId}</span>
                      <span className={styles.logDetails}>{log.details}</span>
                    </button>
                    {selectedLogId === log.id && (
                      <div className={styles.logDetailsExpanded}>
                        <pre>{JSON.stringify(log.rawEvent, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
