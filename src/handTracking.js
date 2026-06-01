import { DrawingUtils, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

const HAND_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const VIDEO_CONSTRAINTS = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 720 },
}

export const READY_STATUS = {
  mode: 'idle',
  label: 'Ready',
  hand: 'No hand',
  confidence: 0,
  gesture: 'None',
  pinching: false,
}

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH)

  try {
    return await createLandmarker(vision, 'GPU')
  } catch (error) {
    console.warn('GPU hand tracking unavailable, falling back to CPU.', error)
    return createLandmarker(vision, 'CPU')
  }
}

export function resizeCanvasToVideo(canvas, video) {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

export function clearCanvas(canvas) {
  const context = canvas?.getContext('2d')

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
}

export function drawHand(canvas, landmarks) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)

  const drawing = new DrawingUtils(context)
  drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
    color: 'rgba(41, 210, 178, 0.92)',
    lineWidth: 5,
  })
  drawing.drawLandmarks(landmarks, {
    fillColor: getLandmarkColor,
    lineWidth: 1,
    radius: ({ index }) => (index === 4 || index === 8 ? 9 : 6),
  })
}

function createLandmarker(vision, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 1,
  })
}

function getLandmarkColor({ index }) {
  if (index === 8) {
    return '#ffb84d'
  }

  if (index === 4) {
    return '#ff6f61'
  }

  return '#f8f4ea'
}
