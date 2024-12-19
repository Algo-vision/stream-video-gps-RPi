const WebSocket = require('ws');
const { spawn } = require('child_process');

// Setup WebSocket server
const wss = new WebSocket.Server({ port: 3000 });

console.log("WebSocket server started on ws://localhost:3000");

// FFmpeg command to capture video from the camera and encode it in H.264
const ffmpeg = spawn('ffmpeg', [
  '-f', 'v4l2',               // Input format: Video4Linux2
  '-input_format' ,'mjpeg',
  '-video_size', '640x480',
  '-framerate' ,'30',
  '-i', '/dev/video0',        // Local camera device
//   '-vf', 'scale=1280:720',    // Resize video (optional)
  '-vcodec', 'libx264',       // Use H.264 codec
  '-preset', 'ultrafast',     // Fast encoding
  '-tune', 'zerolatency',     // Low latency tuning
  '-f', 'mpegts',             // Output format: MPEG-TS
  'pipe:1'                    // Pipe output to stdout
]);

console.log("FFmpeg process started. Capturing video from /dev/video0");

// When the WebSocket connection is established
wss.on('connection', function connection(ws) {
  console.log('Client connected to the WebSocket server');

  // Send FFmpeg stream to the WebSocket client
  ffmpeg.stdout.on('data', (chunk) => {
    ws.send(chunk);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Handle FFmpeg errors
ffmpeg.stderr.on('data', (data) => {
  console.error(`FFmpeg Error: ${data}`);
});

ffmpeg.on('close', (code) => {
  console.log(`FFmpeg process exited with code ${code}`);
});

