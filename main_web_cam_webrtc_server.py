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
from aiortc import RTCPeerConnection, RTCSessionDescription,RTCConfiguration,RTCIceServer
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender


signalingServerUrl = "https://forty-wasps-mix.loca.lt"
clientId = "nodejs"
peerId = "browser"


def force_codec(pc, sender, forced_codec):
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )


pcs = set()


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