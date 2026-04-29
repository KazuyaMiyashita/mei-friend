import { useEffect } from "react";
import { useApplication } from "../context/ApplicationContext";
import { useFocusedPanel } from "../context/FocusedPanelContext";

export function useVerovioKeyboard(panelId: string) {
  const { focusedPanelId } = useFocusedPanel();
  const {
    nextBeat,
    nextEvent,
    prevBeat,
    prevEvent,
    staffUpSnapToBeat,
    staffUpSnapToEvent,
    staffDownSnapToBeat,
    staffDownSnapToEvent,
    pitchUp,
    pitchDown,
  } = useApplication();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this panel is focused
      if (focusedPanelId !== panelId) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            nextBeat();
          } else {
            nextEvent();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            prevBeat();
          } else {
            prevEvent();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (e.altKey) {
            pitchUp();
          } else if (e.shiftKey) {
            staffUpSnapToBeat();
          } else {
            staffUpSnapToEvent();
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (e.altKey) {
            pitchDown();
          } else if (e.shiftKey) {
            staffDownSnapToBeat();
          } else {
            staffDownSnapToEvent();
          }
          break;
        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    focusedPanelId,
    panelId,
    nextBeat,
    nextEvent,
    prevBeat,
    prevEvent,
    staffUpSnapToBeat,
    staffUpSnapToEvent,
    staffDownSnapToBeat,
    staffDownSnapToEvent,
    pitchUp,
    pitchDown,
  ]);
}
