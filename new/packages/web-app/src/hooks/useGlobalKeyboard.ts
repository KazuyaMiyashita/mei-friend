import { useEffect } from "react";
import { useActiveMeiFriend } from "../context/AppStateContext";

interface GlobalKeyboardProps {
  onSave?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
}

export function useGlobalKeyboard({
  onSave,
  onOpen,
  onNew,
}: GlobalKeyboardProps = {}) {
  const { activeMeiFriend, canUndo, canRedo } = useActiveMeiFriend();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z") {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            activeMeiFriend?.redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            activeMeiFriend?.undo();
          }
        }
      } else if (isMod && e.key === "y") {
        if (canRedo) {
          e.preventDefault();
          activeMeiFriend?.redo();
        }
      } else if (isMod && e.key === "s") {
        if (onSave) {
          e.preventDefault();
          onSave();
        }
      } else if (isMod && e.key === "o") {
        if (onOpen) {
          e.preventDefault();
          onOpen();
        }
      } else if (isMod && e.key === "n") {
        if (onNew) {
          e.preventDefault();
          onNew();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMeiFriend, canUndo, canRedo, onSave, onOpen, onNew]);
}
