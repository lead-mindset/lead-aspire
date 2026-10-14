"use client";

// Loaded only in the browser (see WhiteboardDialog): Excalidraw touches window.
import { useEffect, useMemo, useRef } from "react";
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

const DEFAULT_STORAGE_KEY = "aspire.new-york.whiteboard";
const STICKY_COLORS = ["#ffec99", "#b2f2bb", "#a5d8ff", "#ffc9c9", "#eebefa"];
const STICKY_SIZE = 200;

type SavedBoard = {
  elements: unknown[];
  files: Record<string, unknown>;
  viewBackgroundColor?: string;
};

function readBoard(storageKey: string): SavedBoard | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedBoard) : null;
  } catch {
    return null;
  }
}

export type WhiteboardHandle = { exportPng: () => Promise<Blob | null> };

export default function WhiteboardCanvas({
  storageKey = DEFAULT_STORAGE_KEY,
  langCode,
  stickyLabels,
  onReady,
}: {
  /** localStorage key of the saved board (Dallas keeps its own). */
  storageKey?: string;
  langCode: string;
  /** `add` is the button tooltip, `text` the placeholder inside a new note. */
  stickyLabels: { add: string; text: string };
  onReady: (handle: WhiteboardHandle) => void;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const initialData = useMemo(() => {
    const saved = readBoard(storageKey);
    return saved
      ? {
          elements: saved.elements,
          files: saved.files,
          appState: { viewBackgroundColor: saved.viewBackgroundColor },
          scrollToContent: true,
        }
      : null;
  }, [storageKey]);
  const theme = useMemo(
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    [],
  );

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Excalidraw has no sticky-note tool: a note is a filled rectangle with bound text.
  function addSticky(color: string) {
    const api = apiRef.current;
    if (!api) return;

    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    // Center of the visible area, in scene coordinates, nudged so notes don't stack exactly.
    const offset = (api.getSceneElements().length % 5) * 16;
    const sticky = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: width / 2 / zoom.value - scrollX - STICKY_SIZE / 2 + offset,
        y: height / 2 / zoom.value - scrollY - STICKY_SIZE / 2 + offset,
        width: STICKY_SIZE,
        height: STICKY_SIZE,
        backgroundColor: color,
        fillStyle: "solid",
        strokeColor: "transparent",
        roughness: 0,
        roundness: { type: 3 },
        label: {
          text: stickyLabels.text,
          fontSize: 20,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#000000",
        },
      },
    ]);

    api.updateScene({
      elements: [...api.getSceneElements(), ...sticky],
      appState: { selectedElementIds: { [sticky[0].id]: true } },
    });
  }

  return (
    <Excalidraw
      // Saved scene shape matches what Excalidraw serializes; restore() inside
      // Excalidraw validates it on load.
      initialData={initialData as never}
      theme={theme}
      langCode={langCode}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      renderTopRightUI={() => (
        <div style={{ display: "flex", gap: 4 }}>
          {STICKY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => addSticky(color)}
              title={stickyLabels.add}
              aria-label={stickyLabels.add}
              style={{
                width: 28,
                height: 28,
                background: color,
                border: "1px solid #ccc",
                borderRadius: 4,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
      excalidrawAPI={(api) => {
        apiRef.current = api;
        onReady({
          exportPng: async () => {
            const elements = api.getSceneElements();
            if (!elements.length) return null;
            return exportToBlob({
              elements,
              appState: { ...api.getAppState(), exportBackground: true },
              files: api.getFiles(),
              mimeType: "image/png",
              exportPadding: 24,
            });
          },
        });
      }}
      onChange={(elements, appState, files) => {
        // Debounced: onChange fires on every pointer move.
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          try {
            const board: SavedBoard = {
              elements: elements.filter((element) => !element.isDeleted),
              files,
              viewBackgroundColor: appState.viewBackgroundColor,
            };
            localStorage.setItem(storageKey, JSON.stringify(board));
          } catch {
            // Storage full or blocked: the board still works for this visit.
          }
        }, 500);
      }}
    />
  );
}
