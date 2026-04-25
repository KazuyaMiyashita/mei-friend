import { Cursor, MeiFriend } from "@mei-friend/core";
import { VerovioCanvas } from "@src/VerovioCanvas";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import sampleMei from "../../test/fixtures/sample.mei?raw";

const App = () => {
  const [meiFriend, setMeiFriend] = useState<MeiFriend | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const handleSelectionChange = (id: string | null) => {
    setSelectedId(id);
    if (meiFriend && id) {
      const newCursor = Cursor.fromId(meiFriend, id);
      if (newCursor) {
        setCursor(newCursor);
      }
    }
  };

  const debugFilters = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug");

    if (debug === "none" || debug === "false") {
      return { staff: false, note: false, caret: false };
    }

    if (debug) {
      const parts = debug.split(",");
      return {
        staff: parts.includes("staff"),
        note: parts.includes("note"),
        caret: parts.includes("caret"),
      };
    }

    // Default to all true if no param is provided (for general UI exploration)
    return {
      staff: true,
      note: true,
      caret: true,
    };
  }, []);

  const colors = useMemo(
    () => ({
      staffOverlay: "rgba(0, 255, 0, 0.2)", // Green for staff
      noteOverlay: "rgba(255, 0, 0, 0.3)", // Red for note
      caret: "#ff00ff", // Magenta for caret
    }),
    [],
  );

  useEffect(() => {
    const mf = MeiFriend.fromXmlString(sampleMei);
    setMeiFriend(mf);
  }, []);

  if (!meiFriend) return <div>Loading MEI...</div>;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <VerovioCanvas
        meiFriend={meiFriend}
        selectedId={selectedId}
        cursor={cursor}
        onSelectionChange={handleSelectionChange}
        debugFilters={debugFilters}
        colors={colors}
        fitMode="width"
      />
      <div id="selection-status" style={{ padding: "8px", background: "#eee" }}>
        Selected: {selectedId || "none"}
      </div>
    </div>
  );
};

const container = document.getElementById("root");
if (!container) {
  throw new Error("Failed to find the root element");
}
createRoot(container).render(<App />);
