/**
 * UI layer — HUD & dynamic information overlay (Step 7 scope).
 * DOM overlay only; never touches the WebGL canvas directly.
 */

export interface OverlayPanel {
  show(bodyId: string): void;
  hide(): void;
}
