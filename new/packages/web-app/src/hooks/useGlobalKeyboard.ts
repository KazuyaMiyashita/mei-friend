import { useEffect } from "react";
import { useFocusedMeiFriend } from "../context/MeiFriendRegistryContext";

interface GlobalKeyboardProps {
  onSave?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
}

export function useGlobalKeyboard({
  onSave,
  onOpen,
  onNew,
}: GlobalKeyboardProps) {
  const {
    meiFriend: focusedMeiFriend,
    canUndo,
    canRedo,
  } = useFocusedMeiFriend();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z") {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            focusedMeiFriend?.redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            focusedMeiFriend?.undo();
          }
        }
      } else if (isMod && e.key === "y") {
        if (canRedo) {
          e.preventDefault();
          focusedMeiFriend?.redo();
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
  }, [focusedMeiFriend, canUndo, canRedo, onSave, onOpen, onNew]);
}
