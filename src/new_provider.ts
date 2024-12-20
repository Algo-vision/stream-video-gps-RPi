import {
  MediaStreamTrack,
  RTCPeerConnection,
  RTCRtpCodecParameters,
  RtpPacket,
  randomPort,
} from "werift";


import fs from 'fs';
import { createSocket } from "dgram";

import fetch from 'node-fetch';
import { spawn } from 'node:child_process';


const signalingServerUrl = "https://pumped-ray-newly.ngrok-free.app"; // Update with your signaling server URL

const payloadType = 96;
const pc = new RTCPeerConnection({
  codecs: {
    audio: [],
    video: [
      new RTCRtpCodecParameters({
        mimeType: "video/VP8",
        clockRate: 90000,
        payloadType: payloadType,
      }),
    ],
  },
});

const track = new MediaStreamTrack({ kind: "video" });
randomPort().then((port) => {
  const udp = createSocket("udp4");
  udp.bind(port);

  spawn("ffmpeg", [

    "-re",
    "-f", "lavfi",
    "-i", "testsrc=size=640x480:rate=30",
    "-vcodec", "libvpx",
    "-cpu-used", "5",
    "-deadline", "1",
    "-g", "10",
    "-error-resilient", "1",
    "-auto-alt-ref", "1",
    "-f", "rtp", `rtp://127.0.0.1:${port}`
  ]
  );
  udp.on("message", (data) => {
    const rtp = RtpPacket.deSerialize(data);
    rtp.header.payloadType = payloadType;
    track.writeRtp(rtp);
  });
});
pc.addTransceiver(track, { direction: "sendonly" });

const clientId = "nodejs";
const peerId = "browser";
let dataChannel;

// Simulated GPS data
function getGPSData() {
  return {
    latitude: 37.7749, // Replace with dynamic GPS latitude
    longitude: -122.4194, // Replace with dynamic GPS longitude
    timestamp: Date.now(),
  };
}

// Send a message to the signaling server
async function sendMessage(message) {
  await fetch(`${signalingServerUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: peerId, message }),
  });
}
interface peerMsg {
  sdp: RTCSessionDescriptionInit;
}
// Poll for incoming messages from the signaling server
async function receiveMessages() {
  const response = await fetch(`${signalingServerUrl}/receive/${clientId}`);
  const messages: Partial<peerMsg[]> = await response.json();
  for (const message of messages) {
    if (message.sdp) {
      await pc.setRemoteDescription(message.sdp);
      if (message.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendMessage({ sdp: pc.localDescription });
      }
    
    }
  }
}

// Start sending GPS data through the data channel
function startSendingGPSData() {
  setInterval(() => {
    if (dataChannel && dataChannel.readyState === "open") {
      const gpsData = getGPSData();
      dataChannel.send(JSON.stringify(gpsData));
      console.log("Sent GPS data:", gpsData);
    }
  }, 1000);
}

// Add video track to the WebRTC connection
async function addVideoTrack() {
  const videoSource = new RTCVideoSource();
  const track = videoSource.createTrack();
  peerConnection.addTrack(track);

  const ffmpeg = spawn("ffmpeg", [
    "-re", // Read input in real time
    "-i", "video.mp4", // Replace with your video file or camera input
    "-vf", "scale=640:480", // Resize to 640x480
    "-pix_fmt", "yuv420p", // Pixel format for WebRTC
    "-f", "rawvideo",
    "-r", "30", // Frame rate
    "-",
  ]);

  ffmpeg.stdout.on("data", (data) => {
    // Process raw video frame data and feed to WebRTC track
    const width = 640;
    const height = 480;
    const frame = {
      width,
      height,
      data: new Uint8Array(data),
    };
    videoSource.onFrame(frame);
  });

  ffmpeg.stderr.on("data", (data) => {
    console.error(`FFmpeg error: ${data}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });
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

// Start the signaling process
(async function startProvider() {
  await addVideoTrack();
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  setInterval(receiveMessages, 1000); // Poll signaling server
})();