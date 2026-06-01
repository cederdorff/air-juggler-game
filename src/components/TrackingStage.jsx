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
