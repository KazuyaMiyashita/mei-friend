import { useEffect } from "react";
import { useApplication } from "../context/ApplicationContext";
import { useFocusedMeiFriend } from "../context/MeiFriendRegistryContext";

export function useGlobalKeyboard() {
  const { canUndo, canRedo } = useFocusedMeiFriend();
  const { undo, redo, saveWorkspace, openFilePicker } = useApplication();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z") {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            undo();
          }
        }
      } else if (isMod && e.key === "y") {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      } else if (isMod && e.key === "s") {
        e.preventDefault();
        saveWorkspace();
      } else if (isMod && e.key === "o") {
        e.preventDefault();
        openFilePicker();
      } else if (isMod && e.key === "n") {
        // Not implemented
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo, saveWorkspace, openFilePicker]);
}
