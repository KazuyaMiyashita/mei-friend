import type { Cursor } from "@mei-friend/core";
import { useEffect } from "react";
import { type MeiFriendLocation, useFocus } from "../context/FocusContext";

export function useVerovioKeyboard(
  panelId: string,
  meiFriendId: MeiFriendLocation | null,
  cursor: Cursor | null,
  setCursor: (c: Cursor | null) => void,
  setSelectedId: (id: string | null) => void,
) {
  const { focusedPanelId, setMeiFriendSelection } = useFocus();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this panel is focused
      if (focusedPanelId !== panelId || !cursor) return;

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
          nextCursor = e.shiftKey
            ? cursor.staffUp().snapToBeat()
            : cursor.staffUp().snapToEvent();
          break;
        case "ArrowDown":
          e.preventDefault();
          nextCursor = e.shiftKey
            ? cursor.staffDown().snapToBeat()
            : cursor.staffDown().snapToEvent();
          break;
        default:
          return;
      }

      if (nextCursor && nextCursor !== cursor) {
        setCursor(nextCursor);
        const eventId = nextCursor.getEvent()?.id ?? null;
        setSelectedId(eventId);
        if (meiFriendId) {
          setMeiFriendSelection(meiFriendId, eventId, "verovio");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    cursor,
    focusedPanelId,
    panelId,
    meiFriendId,
    setCursor,
    setSelectedId,
    setMeiFriendSelection,
  ]);
}
