import cv2
import asyncio
import websockets
import json
from aiortc import RTCPeerConnection, VideoStreamTrack, RTCSessionDescription,RTCIceCandidate
from aiortc.contrib.media import MediaPlayer,MediaRelay

def handle_candidate( candidate):
    # print('Received ICE candidate:', candidate)
    ip = candidate['candidate'].split(' ')[4]
    port = candidate['candidate'].split(' ')[5]
    protocol = candidate['candidate'].split(' ')[7]
    priority = candidate['candidate'].split(' ')[3]
    foundation = candidate['candidate'].split(' ')[0]
    component = candidate['candidate'].split(' ')[1]
    type = candidate['candidate'].split(' ')[7]
    rtc_candidate = RTCIceCandidate(
        ip=ip,
        port=port,
        protocol=protocol,
        priority=priority,
        foundation=foundation,
        component=component,
        type=type,
        sdpMid=candidate['sdpMid'],
        sdpMLineIndex=candidate['sdpMLineIndex']
    )
    return rtc_candidate

class VideoStream(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.cap = cv2.VideoCapture(0)

    async def recv(self):
        ret, frame = self.cap.read()
        if not ret:
            raise Exception("Camera error or not available")

        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = cv2.resize(frame, (640, 480))  # Rescale if needed

        return frame


async def signaling_handler():
    signaling_server = "ws://localhost:9000"
    websocket = await websockets.connect(signaling_server)

    # Register with the signaling server
    res = await websocket.send(json.dumps({"type": "register", "id": "python-provider"}))
    options = {"framerate": "30", "video_size": "640x480"}

    webcam = MediaPlayer("/dev/video0", format="v4l2", options=options)
    relay = MediaRelay()
    video_track = relay.subscribe(webcam.video)
    pc = RTCPeerConnection()
    pc.addTrack(video_track)
    registered = False

    


    async for message in websocket:
        data = json.loads(message)
        if 'registered' in data:
            registered = True
            continue
        if registered:
            if data["type"] == "signal" and data["targetId"] == "python-provider":
                if "offer" in data:
                    await pc.setRemoteDescription(
                        RTCSessionDescription(
                            sdp=data["offer"]["sdp"], type=data["offer"]["type"]
                        )
                    )
                    answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    sdp_dict={
                                'sdp': pc.localDescription.sdp,
                                'type':pc.localDescription.type
                                }
                    await websocket.send(
                        json.dumps(
                            {
                                "type": "signal",
                                "targetId": data["sourceId"],
                                "answer": sdp_dict,
                            }
                        )
                    )
                    
                elif "candidate" in data:
                    await pc.addIceCandidate(handle_candidate(data['candidate']))


asyncio.run(signaling_handler())
