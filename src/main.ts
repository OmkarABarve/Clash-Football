import { createMatch } from "./entities/factory";
import type { GameState } from "./config/types";
import { wireInput } from "./systems/input";
import { startLoop } from "./systems/loop";
import { syncHud } from "./ui/hud";
import { createCanvasView, renderFrame } from "./ui/render";

const canvas = document.getElementById("game") as HTMLCanvasElement;
if (!canvas) throw new Error("#game canvas missing");

const stateRef: { current: GameState } = { current: createMatch() };
const view = createCanvasView(canvas);

wireInput(stateRef, canvas, view, () => {
  // state already replaced in input handler
});

startLoop(stateRef, (state) => {
  renderFrame(view, state);
  syncHud(state);
});
