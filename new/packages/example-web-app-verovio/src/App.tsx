import { Cursor, MeiFriend } from "@mei-friend/core";
import {
  type DebugFilters,
  VerovioCanvas,
} from "@mei-friend/lib-verovio-react";
import { useCallback, useEffect, useState } from "react";
import type { VerovioOptions } from "verovio";
import styles from "./App.module.css";
import { VerovioCanvasFooter } from "./components/VerovioCanvasFooter";
import { VerovioCanvasHeader } from "./components/VerovioCanvasHeader";

export default function App() {
  const [meiFriend, setMeiFriend] = useState<MeiFriend | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [currentTitle, setCurrentTitle] = useState<string>("Untitled");

  // Verovio Controls State
  const [vrvOptions, setVrvOptions] = useState<VerovioOptions>({
    scale: 50,
    breaks: "auto",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fitMode, setFitMode] = useState<"off" | "width" | "height">("off");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const [debugFilters, setDebugFilters] = useState<DebugFilters>({
    measure: false,
    staff: false,
    note: false,
    caret: false,
  });

  const handleSelectionChange = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (meiFriend && id) {
        const newCursor = Cursor.fromId(meiFriend.getScoreModel(), id);
        if (newCursor) {
          setCursor(newCursor);
        }
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
        const title = instance.mei?.head?.getTitle() || "Untitled";
        setMeiFriend(instance);
        setDraftTitle(title);
        setCurrentTitle(title);
        setCurrentPage(1);
        setSelectedId(null);
        setCursor(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!meiFriend) return;

    const unregister = meiFriend.onUpdate(() => {
      const title = meiFriend.mei?.head?.getTitle() || "Untitled";
      setDraftTitle(title);
      setCurrentTitle(title);
    });

    return () => unregister();
  }, [meiFriend]);

  // Keyboard navigation logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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
          e.preventDefault();
          nextCursor = cursor.staffUp();
          break;
        case "ArrowDown":
          e.preventDefault();
          nextCursor = cursor.staffDown();
          break;
      }

      if (nextCursor && nextCursor !== cursor) {
        setCursor(nextCursor);
        // Highlight the event at the new position (may be null for virtual beat positions)
        const nextEvent = nextCursor.getEvent();
        setSelectedId(nextEvent?.id ?? null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [cursor, meiFriend]);

  const handleTitleSubmit = useCallback(() => {
    if (meiFriend?.mei?.head) {
      meiFriend.mei.head.setTitle(draftTitle);
    }
  }, [meiFriend, draftTitle]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Verovio with MeiFriend</h1>
        <p>
          A proof of concept for embedding Verovio in a React application with
          interactive overlays.
        </p>
        <p style={{ fontSize: "0.9rem", color: "#66d9ef" }}>
          Tip: Click a note and use Arrow Keys to navigate!
        </p>
      </header>

      <div className={styles.scoreContainer}>
        <VerovioCanvasHeader
          fitMode={fitMode}
          setFitMode={setFitMode}
          vrvOptions={vrvOptions}
          setVrvOptions={setVrvOptions}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          debugFilters={debugFilters}
          setDebugFilters={setDebugFilters}
          enabled={!!meiFriend}
        />
        {meiFriend ? (
          <VerovioCanvas
            meiFriend={meiFriend}
            options={vrvOptions}
            currentPage={currentPage}
            fitMode={fitMode}
            selectedId={selectedId}
            debugFilters={debugFilters}
            onSelectionChange={handleSelectionChange}
            onTotalPagesChange={setTotalPages}
          />
        ) : (
          <div className={styles.placeholder}>
            Please select an MEI file to view the score
          </div>
        )}
        <VerovioCanvasFooter
          cursor={cursor}
          selectedId={selectedId}
          enabled={!!meiFriend}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.filePickerRow}>
          <p>Load your own MEI file:</p>
          <input type="file" accept=".mei,.xml" onChange={handleFileChange} />
        </div>
      </div>

      <div className={styles.infoPanel}>
        <h2>MEI Information</h2>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Current Title:</span>
          <span>{currentTitle}</span>
        </div>
        <div className={styles.infoField}>
          <label htmlFor="title-input">New Title:</label>
          <input
            id="title-input"
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            disabled={!meiFriend}
            placeholder={
              meiFriend ? "Enter score title..." : "No MEI file loaded"
            }
          />
          <button
            type="button"
            className={styles.updateBtn}
            onClick={handleTitleSubmit}
            disabled={!meiFriend}
          >
            Update
          </button>
        </div>
      </div>

      <div className={styles.codeSection}>
        <h2>Getting Started</h2>
        <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
          Integrating MeiFriend with Verovio is simple. Initialize a model
          instance and pass it to the canvas component.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            {`import { useState } from "react";
import { MeiFriend } from "@mei-friend/core";
import { VerovioCanvas } from "@mei-friend/lib-verovio-react";

export function ScoreViewer({ initialXml }) {
  const [meiFriend] = useState(() => MeiFriend.fromXmlString(initialXml));

  // The component handles WASM initialization and document updates automatically
  return <VerovioCanvas meiFriend={meiFriend} />;
}`}
          </pre>
        </div>

        <h3>Querying and Updating the Score</h3>
        <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
          By using the MeiFriend API to query or update musical information, the
          content of a VerovioCanvas sharing the same MeiFriend instance can be
          automatically synchronized and updated.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            {`// Get the title
const title = meiFriend.mei?.head?.getTitle();

// Update the title
meiFriend.mei?.head?.setTitle("My New Masterpiece");

// Directly update XML information
meiFriend.update({
  type: "replaceElement",
  targetId: "note-123",
  xml: '<note xml:id="note-123" pname="c" oct="4" dur="4"/>'
});`}
          </pre>
        </div>

        <h3>Advanced Usage: Accessing Verovio Toolkit</h3>
        <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
          You can directly access the internal \`VerovioToolkit\` instance
          through the \`ref\` of \`VerovioCanvas\`. Since the toolkit runs in a
          Web Worker, all methods are asynchronous and return Promises.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            {`import { useRef } from "react";
import { VerovioCanvas, type VerovioCanvasHandle } from "@mei-friend/lib-verovio-react";

export function AdvancedScoreViewer({ meiFriend }) {
  const canvasRef = useRef<VerovioCanvasHandle>(null);

  const handleExportMidi = async () => {
    // Get the proxied toolkit instance (async)
    const tk = await canvasRef.current?.getToolkit();
    if (tk) {
      // All toolkit methods return Promises
      const midiBase64 = await tk.renderToMIDI();
      console.log("MIDI generated:", midiBase64);
    }
  };

  return (
    <>
      <button onClick={handleExportMidi}>Export MIDI</button>
      <VerovioCanvas ref={canvasRef} meiFriend={meiFriend} />
    </>
  );
}`}
          </pre>
        </div>
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "#ffcb6b",
            fontStyle: "italic",
          }}
        >
          Note: While reading data (like \`renderToMIDI\`) is safe, avoid
          mutating the toolkit state (like \`loadData\`) directly, as it may
          cause inconsistencies with the React component's internal state.
        </p>
      </div>
    </div>
  );
}
