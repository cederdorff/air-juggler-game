# Air Juggler Step-by-Step Implementation Guide

This guide shows you how to build Air Juggler from the template project.

You start from:

- https://github.com/cederdorff/webcam-ui

You should implement these files:

- src/gestures.js
- src/hooks/useHandTracking.js
- src/components/TrackingStage.jsx
- src/components/ControlPanel.jsx
- src/App.jsx
- src/App.css

You should not need to change these files:

- src/handTracking.js
- src/components/StatusPill.jsx
- src/index.css

## Step 0: Create the Project From the Template

1. Create your own repository from the template link.
2. Clone it locally.
3. Install dependencies and start development:

```bash
npm install
npm run dev
```

4. Open the app in the browser and confirm webcam permission works.

## Step 1: Implement Gesture Logic in src/gestures.js

Goal: Convert hand landmarks into a stable gameplay control object.

### 1.1 Add landmark constants

```js
const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_BASE: 5,
  INDEX_TIP: 8,
  MIDDLE_BASE: 9,
  MIDDLE_TIP: 12,
  RING_BASE: 13,
  RING_TIP: 16,
  PINKY_BASE: 17,
  PINKY_TIP: 20
};
```

### 1.2 Implement getHandGesture(landmarks)

```js
export function getHandGesture(landmarks) {
  const wrist = landmarks[LANDMARK.WRIST];
  const thumbTip = landmarks[LANDMARK.THUMB_TIP];
  const indexTip = landmarks[LANDMARK.INDEX_TIP];
  const middleBase = landmarks[LANDMARK.MIDDLE_BASE];

  const pinchDistance = getDistance(indexTip, thumbTip);
  const grip = clamp(1 - (pinchDistance - 0.035) / 0.11, 0, 1);
  const isPinching = grip > 0.6;
  const isPointingUp = indexTip.y < wrist.y;
  const openFingerCount = countOpenFingers(landmarks);

  return {
    grip,
    indexTip,
    isOpenHand: openFingerCount >= 4,
    isPinching,
    isPointingUp,
    name: getGestureName({ isPinching, isPointingUp, openFingerCount }),
    rotation: clamp((middleBase.x - wrist.x) * -115, -34, 34)
  };
}
```

### 1.3 Implement movePuckWithGesture(gesture, puck)

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

  return { x: nextX, y: nextY };
}
```

### 1.4 Add helper functions

```js
function getGestureName({ isPinching, isPointingUp, openFingerCount }) {
  if (isPinching) return "Pinch";
  if (openFingerCount >= 4) return "Open hand";
  if (isPointingUp) return "Pointing up";
  return "Tracking";
}

function countOpenFingers(landmarks) {
  const openFingers = [
    landmarks[LANDMARK.INDEX_TIP].y < landmarks[LANDMARK.INDEX_BASE].y,
    landmarks[LANDMARK.MIDDLE_TIP].y < landmarks[LANDMARK.MIDDLE_BASE].y,
    landmarks[LANDMARK.RING_TIP].y < landmarks[LANDMARK.RING_BASE].y,
    landmarks[LANDMARK.PINKY_TIP].y < landmarks[LANDMARK.PINKY_BASE].y
  ];

  return openFingers.filter(Boolean).length;
}

function getDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
```

Checkpoint:

- You can log gesture values and see stable `name`, `grip`, and `isPinching`.

## Step 2: Implement Runtime + Game Loop in src/hooks/useHandTracking.js

Goal: Build camera lifecycle, tracking loop, and game physics.

### 2.1 Add refs and state

```js
const webcamRef = useRef(null);
const canvasRef = useRef(null);
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

### 2.2 Implement start and stop

```js
async function startCamera() {
  if (isRunning || tracking.mode === "loading") return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setTracking(createErrorStatus("Camera unavailable"));
    return;
  }

  setTracking({ ...READY_STATUS, mode: "loading", label: "Loading model" });

  try {
    if (!handLandmarkerRef.current) {
      handLandmarkerRef.current = await createHandLandmarker();
    }

    resetGame();
    setIsRunning(true);
    setTracking(createSearchingStatus());
  } catch (error) {
    console.error(error);
    stopCamera();
    setTracking(createErrorStatus(getCameraErrorLabel(error)));
  }
}

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
```

### 2.3 Implement the frame loop

```js
function runFrameLoop() {
  const video = webcamRef.current?.video;
  const canvas = canvasRef.current;
  const puck = puckRef.current;
  const ball = ballRef.current;
  const handLandmarker = handLandmarkerRef.current;

  if (!video || !canvas || !puck || !ball || !handLandmarker) return;

  resizeCanvasToVideo(canvas, video);

  if (hasNewVideoFrame(video, lastVideoTimeRef.current)) {
    lastVideoTimeRef.current = video.currentTime;
    const results = handLandmarker.detectForVideo(video, performance.now());
    const landmarks = results.landmarks?.[0];

    if (landmarks) {
      drawHand(canvas, landmarks);
      const gesture = getHandGesture(landmarks);
      const puckPosition = movePuckWithGesture(gesture, puck);
      const didUpdateScore = tickGame(gameRef.current, ball, puckPosition, gesture);

      if (didUpdateScore) {
        setGame(createGameSnapshot(gameRef.current));
      }

      setTracking(createTrackingStatus(results, gesture));
    } else {
      clearCanvas(canvas);
      showSearchingPuck(puck);
      setTracking(createSearchingStatus());
    }
  }

  animationRef.current = requestAnimationFrame(runFrameLoop);
}
```

### 2.4 Implement game logic helpers

Use these helpers:

- `createInitialGame(bestScore = 0)`
- `createGameSnapshot(game)`
- `tickGame(game, ball, puck, gesture)`
- `resetBall(game)`
- `placeBall(ball, game)`
- `hideBall(ball)`
- `updateBallElement(ball, x, y, didHit)`

Example hit detection section:

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

### 2.5 Return your hook API

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

- Start game transitions to loading, searching, then tracking.
- Ball reacts to pinch hits and score updates.

## Step 3: Build Stage UI in src/components/TrackingStage.jsx

Goal: Render webcam, landmarks, puck, ball, and stage HUD.

```jsx
import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";

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

- The stage starts camera correctly and shows live score/lives.

## Step 4: Build Control Panel in src/components/ControlPanel.jsx

Goal: Show metrics and controls outside the stage.

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

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCameraButtonLabel(isRunning, isLoading) {
  if (isRunning) return "Stop game";
  if (isLoading) return "Loading...";
  return "Start game";
}
```

Checkpoint:

- Buttons and metrics always reflect current game state.

## Step 5: Compose in src/App.jsx

Goal: Wire the hook to the UI components.

```jsx
import { ControlPanel } from "./components/ControlPanel";
import { StatusPill } from "./components/StatusPill";
import { TrackingStage } from "./components/TrackingStage";
import { useHandTracking } from "./hooks/useHandTracking";
import "./App.css";

function App() {
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Webcam mini game</p>
          <h1>Air Juggler</h1>
        </div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>

      <section className="workspace" aria-label="Air juggler game area">
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
      </section>
    </main>
  );
}

export default App;
```

Checkpoint:

- `App` stays as composition only, with no gameplay logic.

## Step 6: Style the Game in src/App.css

Goal: Match the final game look and responsive behavior.

### 6.1 Layout example

```css
.app-shell {
  width: min(1180px, calc(100% - 32px));
  min-height: 100svh;
  margin: 0 auto;
  padding: 28px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  gap: 16px;
}
```

### 6.2 Stage, puck, and ball example

```css
.stage {
  position: relative;
  min-height: 420px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.webcam-feed,
.landmark-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.control-object {
  --x: 50%;
  --y: 50%;
  --scale: 1;
  --rotate: 0deg;

  position: absolute;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%) rotate(var(--rotate)) scale(var(--scale));
}

.game-ball {
  --x: 50%;
  --y: 24%;

  position: absolute;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%);
  opacity: 0;
}

.game-ball[data-visible="true"] {
  opacity: 1;
}
```

### 6.3 Responsive example

```css
@media (max-width: 880px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stage {
    aspect-ratio: 3 / 4;
  }
}
```

Checkpoint:

- The game remains playable and aligned on desktop and mobile.

## Step 7: Validate With QA

Run:

```bash
npm run lint
npm run build
```

Manual test checklist:

1. Deny camera permission and confirm error status.
2. Start game and confirm loading then searching.
3. Show your hand and confirm landmarks + puck tracking.
4. Pinch near the ball and confirm score increases.
5. Miss the ball and confirm lives decrease.
6. Lose all lives and confirm round reset with best score preserved.
7. Stop game and confirm frame loop stops and canvas clears.
8. Click New round while running and confirm score/lives reset.

## Optional README Deliverable

In README.md, add:

1. What you implemented in each file.
2. One improvement idea you would add next.
3. Any known edge cases.

## Done Criteria

You are done when:

1. You changed the six implementation files listed in this guide.
2. Your gameplay behavior matches Air Juggler.
3. Lint and build both pass.
4. All manual tests pass.
