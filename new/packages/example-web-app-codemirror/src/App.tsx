import { MeiFriend } from "@mei-friend/core";
import type { SyncState } from "@mei-friend/lib-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import styles from "./App.module.css";
import {
  CodeMirrorEditor,
  type CodeMirrorEditorRef,
} from "./components/CodeMirrorEditor";

const INITIAL_MEI = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://music-encoding.org/schema/5.1/mei-all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<mei xmlns="http://music-encoding.org/ns/mei" meiversion="5.1">
  <meiHead>
    <fileDesc>
      <titleStmt>
        <title>Sync Test</title>
      </titleStmt>
    </fileDesc>
  </meiHead>
  <music>
    <body>
      <mdiv>
        <score>
          <scoreDef>
            <staffGrp>
              <staffDef n="1" lines="5" clef.shape="G" clef.line="2" />
            </staffGrp>
          </scoreDef>
          <section>
            <measure n="1">
              <staff n="1">
                <layer n="1">
                  <note xml:id="n1" pname="c" oct="4" dur="4" />
                  <note xml:id="n2" pname="d" oct="4" dur="4" />
                  <note xml:id="n3" pname="e" oct="4" dur="4" />
                  <note xml:id="n4" pname="f" oct="4" dur="4" />
                </layer>
              </staff>
            </measure>
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`;

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
  const [title, setTitle] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [stateA, setStateA] = useState<SyncState>({ status: "idle" });
  const [stateB, setStateB] = useState<SyncState>({ status: "idle" });
  const logIdRef = useRef(0);
  const editorARef = useRef<CodeMirrorEditorRef>(null);
  const editorBRef = useRef<CodeMirrorEditorRef>(null);

  useEffect(() => {
    const instance = MeiFriend.fromXmlString(INITIAL_MEI);
    setMeiFriend(instance);
  }, []);

  useEffect(() => {
    if (!meiFriend) return;

    setTitle(meiFriend.api.getTitle() || "");

    const unregister = meiFriend.onUpdate((events) => {
      setTitle(meiFriend.api.getTitle() || "");

      setLogs((prev) => {
        const newLogs = events.map((e) => {
          logIdRef.current += 1;

          const rawEvent = {
            origin: e.origin,
            isLocal: e.isLocal,
            xmlId: e.xmlId,
            xmlString: e.xmlString,
          };

          return {
            id: logIdRef.current,
            timestamp: new Date(),
            origin: String(e.origin || "unknown"),
            targetId: e.xmlId,
            details: `Updated XML string: ${e.xmlString.substring(0, 50)}...`,
            rawEvent,
          };
        });

        // Keep the latest 100 logs
        return [...newLogs, ...prev].slice(0, 100);
      });
    });

    return () => unregister();
  }, [meiFriend]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const text = await file.text();
        const instance = MeiFriend.fromXmlString(text);
        setMeiFriend(instance);
        setLogs([]); // Clear logs on new file
        setSelectedLogId(null);
      }
    },
    [],
  );

  const handleClearLogs = useCallback(() => {
    setLogs([]);
    setSelectedLogId(null);
  }, []);

  const toggleLogDetails = useCallback((id: number) => {
    setSelectedLogId((prev) => (prev === id ? null : id));
  }, []);

  const getStatusClass = (state: SyncState) => {
    switch (state.status) {
      case "idle":
        return styles.statusIdle;
      case "dirty":
        return styles.statusPending;
      case "invalid":
        return styles.statusInvalid;
      case "applying_external":
        return styles.statusApplying;
      default:
        return "";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>MeiFriend CodeMirror Sync Example</h1>
        <p>
          This example demonstrates bidirectional synchronization between two
          CodeMirror editors using the MeiFriend core.
        </p>
      </header>

      <PanelGroup orientation="vertical" className={styles.verticalGroup}>
        <Panel defaultSize={60} minSize={20}>
          <div className={styles.mainContent}>
            {meiFriend ? (
              <PanelGroup orientation="horizontal">
                <Panel defaultSize={50} minSize={20}>
                  <div className={styles.editorWrapper}>
                    <div className={styles.editorHeaderWrap}>
                      <div className={styles.editorHeader}>
                        <h3>Editor A</h3>
                        <span
                          className={`${styles.statusBadge} ${getStatusClass(stateA)}`}
                        >
                          {stateA.status}
                        </span>
                        {stateA.error && (
                          <span
                            className={styles.errorMessage}
                            title={stateA.error}
                          >
                            {stateA.error}
                          </span>
                        )}
                      </div>
                      <button
                        className={styles.refreshBtn}
                        onClick={() => editorARef.current?.refresh()}
                        title="Overwrite from MeiFriend Model"
                        type="button"
                      >
                        Refresh
                      </button>
                    </div>
                    <CodeMirrorEditor
                      ref={editorARef}
                      meiFriend={meiFriend}
                      origin="editor-a"
                      onStateChange={setStateA}
                    />
                  </div>
                </Panel>
                <PanelResizeHandle className={styles.resizeHandle} />
                <Panel defaultSize={50} minSize={20}>
                  <div className={styles.editorWrapper}>
                    <div className={styles.editorHeaderWrap}>
                      <div className={styles.editorHeader}>
                        <h3>Editor B</h3>
                        <span
                          className={`${styles.statusBadge} ${getStatusClass(stateB)}`}
                        >
                          {stateB.status}
                        </span>
                        {stateB.error && (
                          <span
                            className={styles.errorMessage}
                            title={stateB.error}
                          >
                            {stateB.error}
                          </span>
                        )}
                      </div>
                      <button
                        className={styles.refreshBtn}
                        onClick={() => editorBRef.current?.refresh()}
                        title="Overwrite from MeiFriend Model"
                        type="button"
                      >
                        Refresh
                      </button>
                    </div>
                    <CodeMirrorEditor
                      ref={editorBRef}
                      meiFriend={meiFriend}
                      origin="editor-b"
                      onStateChange={setStateB}
                    />
                  </div>
                </Panel>
              </PanelGroup>
            ) : (
              <div className={styles.placeholder}>
                Initializing MeiFriend...
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className={styles.resizeHandleHorizontal} />

        <Panel defaultSize={40} minSize={10}>
          <div className={styles.bottomSection}>
            <div className={styles.controls}>
              <div className={styles.filePickerRow}>
                <span className={styles.smallLabel}>Load MEI file:</span>
                <input
                  type="file"
                  accept=".mei,.xml"
                  onChange={handleFileChange}
                  className={styles.smallInput}
                />
                <span className={styles.divider}>|</span>
                <span className={styles.smallLabel}>Title:</span>
                <span className={styles.titleValue}>{title || "Untitled"}</span>
              </div>
            </div>

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
                    No events yet. Try editing the XML in one of the editors.
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
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
