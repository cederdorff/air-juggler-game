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

function getGestureName({ isPinching, isPointingUp, openFingerCount }) {
  if (isPinching) {
    return "Pinch";
  }

  if (openFingerCount >= 4) {
    return "Open hand";
  }

  if (isPointingUp) {
    return "Pointing up";
  }

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
