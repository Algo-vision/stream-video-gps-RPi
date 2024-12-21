import argparse
import asyncio
import json
import logging
import os
import platform
import ssl
import aiohttp
import json

from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription,RTCConfiguration,RTCIceServer,RTCIceCandidate
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender


signalingServerUrl = "https://stream-video-gps-rpi.onrender.com"
clientId = "nodejs"
peerId = "browser"

async def handle_candidate(pc, candidate):
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
        await pc.addIceCandidate(rtc_candidate)

def force_codec(pc, sender, forced_codec):
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )


pcs = set()
async def index(request):
    content = open(os.path.join("index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)

async def main_loop():
   
    options = {"framerate": "30", "video_size": "640x480"}

    webcam = MediaPlayer("/dev/video0", format="v4l2", options=options)
    relay = MediaRelay()
    video_track = relay.subscribe(webcam.video)

    pc = RTCPeerConnection(
        configuration=RTCConfiguration(iceServers=[
            RTCIceServer(urls="stun:stun.l.google.com:19302",)
        ])
    )
    video_sender = pc.addTrack(video_track)
    while True:
        async with aiohttp.ClientSession(
            headers={
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "1",
            }
        ) as session:

            async with session.get(
                signalingServerUrl + f"/receive/{clientId}"
            ) as response:

                print("Status:", response.status)
                print("Content-type:", response.headers["content-type"])
                
                json_data = await response.text()
                try:
                    messages = json.loads(json_data)
                except:
                    continue
                for msg in messages:
                    if 'type' in msg and msg['type'] == 'candidate':
                        await handle_candidate(pc,msg['candidate'])


                    else:
                        await pc.setRemoteDescription(
                            RTCSessionDescription(sdp=msg["sdp"]['sdp'], type=msg['sdp']["type"])
                        )
                        answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)
                        sdp_dict={
                            'sdp': pc.localDescription.sdp,
                            'type':pc.localDescription.type

                        }
                        answer_msg = {"to": peerId, "message": {"sdp": sdp_dict}}

                        await session.post(url = f"{signalingServerUrl}/send", data=json.dumps(answer_msg))



asyncio.run(main_loop())