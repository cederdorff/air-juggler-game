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
  if (isRunning) {
    return "Stop game";
  }

  if (isLoading) {
    return "Loading...";
  }

  return "Start game";
}
