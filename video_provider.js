const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");
const fs = require("fs");
const fetch = require("node-fetch");

const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

const clientId = "nodejs";
const peerId = "browser";
const signalingServerUrl = "http://localhost:9000";
let dataChannel;

// Simulated GPS data
function getGPSData() {
  return {
    latitude: 37.7749, // Replace with dynamic GPS latitude
    longitude: -122.4194, // Replace with dynamic GPS longitude
    timestamp: Date.now(),
  };
}

async function sendMessage(message) {
  await fetch(`${signalingServerUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: peerId, message }),
  });
}

async function receiveMessages() {
  const response = await fetch(`${signalingServerUrl}/receive/${clientId}`);
  const messages = await response.json();
  for (const message of messages) {
    if (message.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
      if (message.sdp.type === "offer") {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendMessage({ sdp: peerConnection.localDescription });
      }
    } else if (message.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  }
}

// Add video stream
async function addVideoTrack() {
  const { spawn } = require("child_process");
  const ffmpeg = spawn("ffmpeg", [
    "-re", // Read input in real time
    "-i", "video.mp4", // Replace with your video file or camera input
    "-f", "rawvideo",
    "-pix_fmt", "yuv420p",
    "-s", "640x480", // Resolution
    "-r", "30", // Frame rate
    "-an", // No audio
    "-",
  ]);

  ffmpeg.stdout.on("data", (data) => {
    // Process raw video frame data here
    // Example: send to WebRTC track
  });

  ffmpeg.stderr.on("data", (data) => {
    console.error(`FFmpeg error: ${data}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg process closed with code ${code}`);
  });
}

// Start sending GPS data periodically
function startSendingGPSData() {
  setInterval(() => {
    if (dataChannel && dataChannel.readyState === "open") {
      const gpsData = getGPSData();
      dataChannel.send(JSON.stringify(gpsData));
      console.log("Sent GPS data:", gpsData);
    }
  }, 1000);
}

// Set up WebRTC data channel
peerConnection.ondatachannel = (event) => {
  dataChannel = event.channel;
  dataChannel.onopen = () => {
    console.log("Data channel opened");
    startSendingGPSData();
  };
  dataChannel.onerror = (error) => console.error("Data channel error:", error);
};

// Start signaling
(async function startProvider() {
  await addVideoTrack();
  setInterval(receiveMessages, 1000); // Poll signaling server
})();