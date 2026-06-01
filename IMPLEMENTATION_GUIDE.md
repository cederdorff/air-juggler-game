# Air Juggler Implementation Guide

This guide helps you build the Air Juggler game step by step.

You start from the template:

- https://github.com/cederdorff/webcam-ui

You end with the Air Juggler game in this repository.

## Big Picture: What You Are Building

You are building a small real-time input system.

The full flow is:

1. Your webcam provides video frames.
2. MediaPipe detects hand landmarks in each frame.
3. Gesture logic converts landmarks into simple values (`isPinching`, `grip`, `indexTip`).
4. Game logic uses those values to move the puck and update ball physics.
5. React renders the updated state (score, lives, status, and visuals).

If something breaks, check this pipeline one step at a time instead of debugging everything at once.

## What You Will Implement

You implement these files:

- `src/gestures.js`
- `src/hooks/useHandTracking.js`
- `src/components/TrackingStage.jsx`
- `src/components/ControlPanel.jsx`
- `src/App.jsx`
- `src/App.css`

Step-to-file map:

- Step 1 -> `src/gestures.js`
- Step 2 -> `src/hooks/useHandTracking.js`
- Step 3 -> `src/components/TrackingStage.jsx`
- Step 3.5 -> `src/App.css` (add essential styling)
- Step 4 -> `src/components/ControlPanel.jsx`
- Step 5 -> `src/App.jsx`
- Step 6 -> `src/App.css` (add final styling and responsive refinements)

## Step 0: Create and Run the Template

In this step, you are setting up a clean starting point.
Do not skip this. If the template does not run before edits, it becomes much harder to know whether errors come from your changes or from setup issues.

Open the template repository in your browser:

- [https://github.com/cederdorff/webcam-ui](https://github.com/cederdorff/webcam-ui)

Click `Use this template`.

Choose `Create a new repository`.

Give your repository a clear name.

Create the repository. Now you have your own copy of the project on your GitHub account.

On your new GitHub repository page, click the green `Code` button.

If you use GitHub Desktop:

1. Choose `Open with GitHub Desktop`.
2. Choose where to save the project on your computer.
3. Click `Clone`.
4. Click `Open in Visual Studio Code`.

Open the project folder in VS Code.

Open a terminal in VS Code:

```text
Terminal -> New Terminal
```

Install the project dependencies:

```bash
npm install
```

This downloads the code libraries the project needs.

Start the development server:

```bash
npm run dev
```

Confirm the template works before you make changes.

Why this matters:

- You verify your environment (Node, npm, webcam permissions) is correct.
- You create a stable baseline before implementing game features.

## Step 1: Update Gesture Output (src/gestures.js)

File you edit in this step: `src/gestures.js`.

Action now: Open `src/gestures.js` and make the change below.

In the template, `movePuckWithGesture` updates puck styles but does not return the puck position.

You need it to return `{ x, y }` so game physics can use the current puck coordinates.

Think of this as connecting two systems:

- Gesture system decides where the puck should be.
- Game system needs that position to decide whether the ball was hit.

### Change

```js
export function movePuckWithGesture(gesture, puck) {
  const targetX = 1 - clamp(gesture.indexTip.x, 0.03, 0.97);
  const targetY = clamp(gesture.indexTip.y, 0.06, 0.94);
  const currentX = Number(puck.dataset.x) || 0.5;
  const currentY = Number(puck.dataset.y) || 0.5;
  const nextX = currentX + (targetX - currentX) * 0.26;
  const nextY = currentY + (targetY - currentY) * 0.26;

  puck.dataset.x = String(nextX);
  puck.dataset.y = String(nextY);
  puck.style.setProperty("--x", `${nextX * 100}%`);
  puck.style.setProperty("--y", `${nextY * 100}%`);
  puck.style.setProperty("--scale", String(0.96 + gesture.grip * 0.42));
  puck.style.setProperty("--rotate", `${gesture.rotation}deg`);
  puck.toggleAttribute("data-gripped", gesture.isPinching);
  puck.removeAttribute("data-searching");

  return {
    x: nextX,
    y: nextY
  };
}
```

Checkpoint:

- Your gesture behavior is unchanged.
- You now get puck coordinates back from `movePuckWithGesture`.

Test now (before continuing):

1. Save `src/gestures.js`.
2. Confirm the app still runs with no compile errors.
3. If the stage is running, confirm puck tracking still works.

If your score never changes later, this is one of the first places to re-check.

## Step 2: Add Game State + Physics (src/hooks/useHandTracking.js)

File you edit in this step: `src/hooks/useHandTracking.js`.

Action now: Open `src/hooks/useHandTracking.js`.
All substeps in Step 2 are changes in this same file.

This is the biggest change in the project.

In the template, this hook tracks hand state only.
In Air Juggler, it also manages a ball game loop (score, lives, collisions).

You can think of this hook as the game engine.
It runs every frame and decides both tracking state and game state.

### 2.1 Add refs and state

Add `ballRef`, `gameRef`, and `game` state.

Why both `gameRef` and `game` state?

- `gameRef` stores mutable values that change every animation frame without causing rerenders.
- `game` state stores a UI snapshot so React can render score/lives efficiently.

```js
const puckRef = useRef(null);
const ballRef = useRef(null);
const handLandmarkerRef = useRef(null);
const animationRef = useRef(0);
const lastVideoTimeRef = useRef(-1);
const gameRef = useRef(createInitialGame());

const [isRunning, setIsRunning] = useState(false);
const [tracking, setTracking] = useState(READY_STATUS);
const [game, setGame] = useState(() => createGameSnapshot(gameRef.current));
```

### 2.2 Add reset behavior

Still editing `src/hooks/useHandTracking.js`.

Add `resetGame()` and update `stopCamera()` to hide the ball.

This gives you predictable round boundaries:

- `stopCamera()` resets runtime visuals.
- `resetGame()` starts a fresh round while keeping `bestScore`.

```js
function stopCamera() {
  cancelAnimationFrame(animationRef.current);
  animationRef.current = 0;
  lastVideoTimeRef.current = -1;

  clearCanvas(canvasRef.current);
  showSearchingPuck(puckRef.current);
  hideBall(ballRef.current);
  setIsRunning(false);
  setTracking(READY_STATUS);
}

function resetGame() {
  const nextGame = createInitialGame(gameRef.current.bestScore);

  gameRef.current = nextGame;
  placeBall(ballRef.current, nextGame);
  setGame(createGameSnapshot(nextGame));
}
```

### 2.3 Update frame loop

Still editing `src/hooks/useHandTracking.js`.

Use returned puck coordinates and run game physics on every tracked frame.

Important mental model:

- Tracking gives you input.
- Physics consumes that input.
- UI is updated only when needed.

```js
const puckPosition = movePuckWithGesture(gesture, puck);

const didUpdateScore = tickGame(gameRef.current, ball, puckPosition, gesture);

if (didUpdateScore) {
  setGame(createGameSnapshot(gameRef.current));
}
```

### 2.4 Start game with reset

Still editing `src/hooks/useHandTracking.js`.

In `startCamera()`, reset game before tracking starts:

This ensures the first visible frame already has valid ball state.

```js
if (!handLandmarkerRef.current) {
  handLandmarkerRef.current = await createHandLandmarker();
}

resetGame();
setIsRunning(true);
setTracking(createSearchingStatus());
```

### 2.5 Add full game helper functions

Still editing `src/hooks/useHandTracking.js`.

Add these functions exactly as part of the hook module:

- `createInitialGame(bestScore = 0)`
- `createGameSnapshot(game)`
- `tickGame(game, ball, puck, gesture)`
- `resetBall(game)`
- `placeBall(ball, game)`
- `hideBall(ball)`
- `updateBallElement(ball, x, y, didHit)`
- `randomInRange(min, max)`
- `clamp(value, min, max)`

Example from `tickGame` (pinch hit + scoring):

```js
const now = performance.now();
const distance = Math.hypot(game.x - puck.x, game.y - puck.y);
const canHit = now - game.lastHitTime > 140;

if (gesture.isPinching && distance < 0.12 && canHit) {
  game.lastHitTime = now;
  game.score += 1;
  game.bestScore = Math.max(game.bestScore, game.score);
  game.vy = -Math.max(0.013, Math.abs(game.vy) * 0.9 + 0.005);
  game.vx += clamp((game.x - puck.x) * 0.04, -0.005, 0.005);

  updateBallElement(ball, game.x, game.y, true);
  return true;
}
```

What `tickGame` is responsible for:

- Apply gravity and velocity.
- Keep the ball inside allowed bounds.
- Detect pinch hits and apply bounce impulse.
- Handle lives and round reset.
- Reflect game values back into DOM styles for ball position/feedback.

### 2.6 Return new hook API

Still editing `src/hooks/useHandTracking.js`.

Expose `ballRef`, `game`, and `resetGame`:

```js
return {
  canvasRef,
  handleCameraError,
  handleCameraReady,
  isLoading: tracking.mode === "loading",
  isRunning,
  game,
  ballRef,
  puckRef,
  resetGame,
  startCamera,
  stopCamera,
  tracking,
  webcamRef
};
```

Checkpoint:

- You can start/stop game.
- Ball appears and updates.
- Score and lives can change.

Test now (before continuing):

1. Click `Start game`.
2. Confirm the ball is visible.
3. Confirm pinch near the ball increases score.
4. Confirm missing the ball decreases lives.

Debug tip:

- If the ball is invisible, check `placeBall`, `hideBall`, and `data-visible` styles.
- If the ball moves but score does not change, check pinch threshold and hit distance.

## Step 3: Add Ball + HUD to Stage (src/components/TrackingStage.jsx)

File you edit in this step: `src/components/TrackingStage.jsx`.

Action now: Open `src/components/TrackingStage.jsx` and update the component with the code below.

In the template, stage renders webcam, landmarks, puck, and start button.

In Air Juggler, stage also renders:

- Ball element
- In-stage score box
- Button text `Start game`

The stage is your real-time scene.
Everything that feels live to the player belongs here.

### Change

```jsx
export function TrackingStage({
  ballRef,
  canvasRef,
  game,
  onCameraError,
  onCameraReady,
  isLoading,
  isRunning,
  onStartCamera,
  puckRef,
  webcamRef
}) {
  return (
    <div className="stage" data-running={isRunning ? "true" : "false"}>
      {isRunning && (
        <Webcam
          ref={webcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onCameraReady}
          onUserMediaError={onCameraError}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
      )}
      <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" />
      <div ref={ballRef} className="game-ball" aria-hidden="true"></div>
      <div ref={puckRef} className="control-object" role="img" aria-label="Puck">
        <span></span>
      </div>

      <div className="stage-score" aria-live="polite">
        <p>Score: {game.score}</p>
        <p>Lives: {game.lives}</p>
      </div>

      {!isRunning && (
        <div className="start-overlay">
          <button type="button" onClick={onStartCamera} disabled={isLoading}>
            {isLoading ? "Loading..." : "Start game"}
          </button>
        </div>
      )}
    </div>
  );
}
```

Checkpoint:

- Stage now shows score/lives and a game ball.

Test now (before continuing):

1. Start the game.
2. Confirm stage HUD values (`Score`, `Lives`) render and update.
3. Confirm `Start game` overlay only appears when not running.

If score updates in the panel but not on stage, verify you pass `game` into `TrackingStage`.

## Step 3.5: Add Essential CSS Early (src/App.css)

File you edit in this step: `src/App.css`.

Action now: Open `src/App.css` and add the essential styles below before continuing.

In this step, you are explicitly adding styling (visual CSS), not changing game logic.

Why now:

- You get immediate visual feedback while building the rest of the logic.
- The ball and HUD become visible early, which makes debugging much easier.

Add at least these essential rules:

```css
.stage {
  position: relative;
  min-height: 420px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.stage-score {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
}

.game-ball {
  --x: 50%;
  --y: 24%;

  position: absolute;
  left: var(--x);
  top: var(--y);
  z-index: 4;
  width: clamp(24px, 3vw, 34px);
  aspect-ratio: 1;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  opacity: 0;
}

.game-ball[data-visible="true"] {
  opacity: 1;
}

.game-ball[data-hit="true"] {
  transform: translate(-50%, -50%) scale(1.18);
}
```

Test now (before continuing):

1. Start the game.
2. Confirm the ball can be seen.
3. Confirm score/lives text is visible on stage.

## Step 4: Replace Metrics and Add Reset Button (src/components/ControlPanel.jsx)

File you edit in this step: `src/components/ControlPanel.jsx`.

Action now: Open `src/components/ControlPanel.jsx` and apply the changes below.

In the template, panel shows hand/gesture/confidence/pinch.

In Air Juggler, panel changes to game metrics:

- Score
- Lives
- Best
- Gesture

It also adds a `New round` button.

You are shifting the panel from "tracking diagnostics" to "game dashboard".
This is why hand/confidence/pinch metrics are removed here.

### Change

```jsx
export function ControlPanel({ game, isLoading, isRunning, onResetGame, onStartCamera, onStopCamera, tracking }) {
  return (
    <aside className="control-panel">
      <Metric label="Score" value={game.score} />
      <Metric label="Lives" value={game.lives} />
      <Metric label="Best" value={game.bestScore} />
      <Metric label="Gesture" value={tracking.gesture} />

      <button
        type="button"
        className="camera-button"
        onClick={isRunning ? onStopCamera : onStartCamera}
        disabled={isLoading}
      >
        {isRunning ? "Stop game" : getCameraButtonLabel(isRunning, isLoading)}
      </button>

      <button
        type="button"
        className="camera-button secondary"
        onClick={onResetGame}
        disabled={!isRunning || isLoading}
      >
        New round
      </button>
    </aside>
  );
}
```

Also remove old `formatPercent` logic.

Checkpoint:

- Panel reflects game stats instead of pure tracking diagnostics.

Test now (before continuing):

1. Confirm panel shows `Score`, `Lives`, `Best`, and `Gesture`.
2. Confirm `New round` is disabled when game is not running.
3. Start the game and confirm `New round` becomes enabled.

If `New round` never enables, verify `disabled={!isRunning || isLoading}` logic.

## Step 5: Wire New Props in App (src/App.jsx)

File you edit in this step: `src/App.jsx`.

Action now: Open `src/App.jsx` and update the imports, hook destructuring, and component props.

In the template, App only passes tracking refs and camera actions.

In Air Juggler, App additionally passes:

- `ballRef`
- `game`
- `resetGame`

App should stay a composition layer.
Keep game logic inside the hook, and keep display logic in components.

### Change

```jsx
const {
  ballRef,
  canvasRef,
  game,
  handleCameraError,
  handleCameraReady,
  isLoading,
  isRunning,
  puckRef,
  resetGame,
  startCamera,
  stopCamera,
  tracking,
  webcamRef
} = useHandTracking();
```

```jsx
<TrackingStage
  ballRef={ballRef}
  canvasRef={canvasRef}
  game={game}
  onCameraError={handleCameraError}
  onCameraReady={handleCameraReady}
  isLoading={isLoading}
  isRunning={isRunning}
  onStartCamera={startCamera}
  puckRef={puckRef}
  webcamRef={webcamRef}
/>

<ControlPanel
  game={game}
  isLoading={isLoading}
  isRunning={isRunning}
  onResetGame={resetGame}
  onStartCamera={startCamera}
  onStopCamera={stopCamera}
  tracking={tracking}
/>
```

Also update labels:

- `Webcam control` -> `Webcam mini game`
- `Hand Puck` -> `Air Juggler`

Checkpoint:

- App renders full game layout and all props are connected.

Test now (before continuing):

1. Start and stop the game from the panel button.
2. Confirm stage and panel both update from the same game state.
3. Confirm no `undefined` errors in the browser console.

If you get `undefined` prop errors, compare your hook return object and App destructuring side by side.

## Step 6: Add Game Visual Styles (src/App.css)

File you edit in this step: `src/App.css`.

Action now: Stay in `src/App.css` and finish the full styling and responsive polish.

In this step, you continue adding styling to complete the final look and responsive behavior.

In the template, CSS styles stage and puck only.

In Air Juggler, add styles for:

- `.stage-score`
- `.game-ball`
- `.game-ball[data-visible="true"]`
- `.game-ball[data-hit="true"]`
- `.camera-button.secondary`

These styles do more than look nice:

- `.game-ball` and data attributes are part of gameplay feedback.
- `.stage-score` gives immediate in-context status while playing.
- Secondary button styling communicates that `New round` is not the primary action.

Update layout grid to support one extra control button:

```css
.control-panel {
  grid-template-rows: repeat(4, minmax(72px, auto)) auto auto;
}
```

And at tablet width:

```css
@media (max-width: 880px) {
  .control-panel {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: auto auto auto;
  }
}
```

Example ball style:

```css
.game-ball {
  --x: 50%;
  --y: 24%;

  position: absolute;
  left: var(--x);
  top: var(--y);
  z-index: 4;
  width: clamp(24px, 3vw, 34px);
  aspect-ratio: 1;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, #ffffff 24%, #f06a57 68%);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
  opacity: 0;
}
```

Checkpoint:

- Ball appears/disappears with state.
- Hit animation is visible.
- `New round` button styling is distinct.

Test now (before finishing):

1. Confirm stage, panel, and controls look correct on desktop.
2. Resize to mobile width and confirm layout still works.
3. Confirm ball hit animation and score HUD are still visible.

If ball position looks wrong, verify CSS vars `--x` and `--y` are being set in `updateBallElement`.

## How to Use This Guide Well

Use this guide as an implementation path, not just a copy path:

- Implement one step.
- Run the app.
- Confirm the checkpoint.
- Continue only when that step works.

If you get stuck, return to the Big Picture section and find which part of the pipeline is failing:

- Webcam input
- Landmark detection
- Gesture values
- Game physics
- UI rendering
