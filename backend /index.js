const express = require("express");
require("dotenv").config();
const axios = require("axios");
const cors = require("cors");
const mediasoup = require("mediasoup");

const app = express();
app.use(express.json());
app.use(cors());

let worker;
let router;
let webRtcTransport;

async function createMediasoupWorker() {
  try {
    worker = await mediasoup.createWorker();
    router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
      ],
    });
  } catch (error) {
    console.error("Error creating Mediasoup worker:", error);
  }
}

createMediasoupWorker();

app.post("/api/webrtc/initialize-session", async (req, res) => {
  try {
    if (!webRtcTransport) {
      webRtcTransport = await router.createWebRtcTransport({
        listenIps: ["0.0.0.0"],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
    }

    const {
      data: { id: streamId, offer, session_id: sessionId },
    } = await axios.post(
      `https://api.d-id.com/talks/streams`,
      {
        source_url:
          "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg",
      },
      {
        headers: {
          Authorization: `Basic ${process.env.DID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const sdpOffer = offer.sdp;
    const iceCandidates = parseIceCandidates(sdpOffer);

    res.json({
      streamId,
      sessionId,
      transportOptions: {
        id: webRtcTransport.id,
        iceParameters: webRtcTransport.iceParameters,
        iceCandidates,
      },
      sdpOffer,
    });
  } catch (error) {
    console.error("Error initializing WebRTC session:", error);
    res.status(500).json({ error: error.message });
  }
});

function parseIceCandidates(sdp) {
  const candidates = [];
  const lines = sdp.split("\n");
  lines.forEach((line) => {
    if (line.startsWith("a=candidate:")) {
      const parts = line.substring("a=candidate:".length).split(" ");
      if (parts.length > 5) {
        candidates.push({
          candidate: parts[0],
          sdpMid: parts[3],
          sdpMLineIndex: parseInt(parts[4], 10),
        });
      }
    }
  });
  return candidates;
}

app.post("/send-candidate", async (req, res) => {
  const { candidate, sdpMid, sdpMLineIndex, sessionId, streamId } = req.body;
  try {
    await axios.post(
      `${process.env.DID_API_URL}/talks/streams/${streamId}/ice`,
      {
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId,
      },
      {
        headers: {
          Authorization: `Basic ${process.env.DID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("Error sending ICE candidate:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/complete-sdp", async (req, res) => {
  const { streamId, sessionId, answer } = req.body;

  try {
    await axios.post(
      `${process.env.DID_API_URL}/talks/streams/${streamId}/sdp`,
      {
        answer: { type: "answer", sdp: answer },
        session_id: sessionId,
      },
      {
        headers: {
          Authorization: `Basic ${process.env.DID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("Error completing SDP setup:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
