import { exportToCanvas } from "@excalidraw/utils/export";

import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common/constants";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

export const generateThumbnail = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): Promise<string> => {
  const canvas = await exportToCanvas({
    elements,
    appState,
    files,
    exportPadding: DEFAULT_EXPORT_PADDING,
    maxWidthOrHeight: Math.max(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT),
  });

  const SvgCanvas = document.createElement("canvas");
  SvgCanvas.width = THUMBNAIL_WIDTH;
  SvgCanvas.height = THUMBNAIL_HEIGHT;
  const SvgCanvasContext = SvgCanvas.getContext("2d")!;

  const sourceAspectRatio = canvas.width / canvas.height;
  const targetAspectRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;

  let drawWidth = THUMBNAIL_WIDTH;
  let drawHeight = THUMBNAIL_HEIGHT;
  let drawX = 0;
  let drawY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    drawHeight = THUMBNAIL_WIDTH / sourceAspectRatio;
    drawY = (THUMBNAIL_HEIGHT - drawHeight) / 2;
  } else {
    drawWidth = THUMBNAIL_HEIGHT * sourceAspectRatio;
    drawX = (THUMBNAIL_WIDTH - drawWidth) / 2;
  }

  SvgCanvasContext.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);

  return SvgCanvas.toDataURL("image/png");
};
