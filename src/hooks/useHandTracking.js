import { useEffect, useRef, useState } from "react";
import { READY_STATUS, clearCanvas, createHandLandmarker, drawHand, resizeCanvasToVideo } from "../handTracking";
import { getHandGesture, movePuckWithGesture } from "../gestures";

export function useHandTracking() {
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

  function runFrameLoop() {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    const puck = puckRef.current;
    const ball = ballRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !canvas || !puck || !ball || !handLandmarker) {
      return;
    }

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

  async function startCamera() {
    if (isRunning || tracking.mode === "loading") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setTracking(createErrorStatus("Camera unavailable"));
      return;
    }

    setTracking({
      ...READY_STATUS,
      mode: "loading",
      label: "Loading model"
    });

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

  function handleCameraReady() {
    cancelAnimationFrame(animationRef.current);
    runFrameLoop();
  }

  function handleCameraError(error) {
    console.error(error);
    stopCamera();
    setTracking(createErrorStatus(getCameraErrorLabel(error)));
  }

  useEffect(() => {
    showSearchingPuck(puckRef.current);
    hideBall(ballRef.current);

    return () => {
      cancelAnimationFrame(animationRef.current);
      handLandmarkerRef.current?.close();
    };
  }, []);

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
}

function hasNewVideoFrame(video, lastVideoTime) {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.currentTime !== lastVideoTime
  );
}

function showSearchingPuck(puck) {
  puck?.setAttribute("data-searching", "true");
  puck?.removeAttribute("data-gripped");
}

function createSearchingStatus() {
  return {
    ...READY_STATUS,
    mode: "searching",
    label: "Looking for hand"
  };
}

function createTrackingStatus(results, gesture) {
  const hand = results.handednesses?.[0]?.[0];

  return {
    mode: "tracking",
    label: gesture.isPinching ? "Pinch active" : gesture.name,
    hand: hand?.categoryName ?? "Hand",
    confidence: hand?.score ?? gesture.grip,
    gesture: gesture.name,
    pinching: gesture.isPinching
  };
}

function createErrorStatus(label) {
  return {
    ...READY_STATUS,
    mode: "error",
    label
  };
}

function getCameraErrorLabel(error) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera blocked";
  }

  return "Tracking failed";
}

function createInitialGame(bestScore = 0) {
  return {
    bestScore,
    lastHitTime: 0,
    lives: 3,
    score: 0,
    vx: randomInRange(-0.0036, 0.0036),
    vy: 0.0028,
    x: 0.5,
    y: 0.24
  };
}

function createGameSnapshot(game) {
  return {
    bestScore: game.bestScore,
    lives: game.lives,
    score: game.score
  };
}

function tickGame(game, ball, puck, gesture) {
  game.vy += 0.00046;
  game.x += game.vx;
  game.y += game.vy;

  if (game.x <= 0.05 || game.x >= 0.95) {
    game.x = clamp(game.x, 0.05, 0.95);
    game.vx *= -0.92;
  }

  if (game.y <= 0.07) {
    game.y = 0.07;
    game.vy = Math.abs(game.vy) * 0.5;
  }

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

  if (game.y >= 0.98) {
    game.lives -= 1;

    if (game.lives > 0) {
      resetBall(game);
    } else {
      game.bestScore = Math.max(game.bestScore, game.score);
      game.score = 0;
      game.lives = 3;
      resetBall(game);
    }

    updateBallElement(ball, game.x, game.y, false);
    return true;
  }

  updateBallElement(ball, game.x, game.y, false);
  return false;
}

function resetBall(game) {
  game.x = 0.5;
  game.y = 0.24;
  game.vx = randomInRange(-0.0036, 0.0036);
  game.vy = 0.0028;
}

function placeBall(ball, game) {
  updateBallElement(ball, game.x, game.y, false);
  ball?.setAttribute("data-visible", "true");
}

function hideBall(ball) {
  ball?.setAttribute("data-visible", "false");
}

function updateBallElement(ball, x, y, didHit) {
  ball.style.setProperty("--x", `${x * 100}%`);
  ball.style.setProperty("--y", `${y * 100}%`);

  if (didHit) {
    ball.setAttribute("data-hit", "true");
  } else {
    ball.removeAttribute("data-hit");
  }
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
