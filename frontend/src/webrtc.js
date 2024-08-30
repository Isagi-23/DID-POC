import axios from "axios";

let sessionId = null;
let streamId = null;
let pc = null;

export const connectionSetup = async (videoRef) => {
    
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    iceTransportPolicy: "all",
    bundlePolicy: "balanced",
    rtcpMuxPolicy: "require",
    iceCandidatePoolSize: 10,
  });

  let iceConnectionAttempts = 0;
  const maxAttempts = 3;

  const retryIceConnection = async () => {
    console.log("here")
    if (iceConnectionAttempts < maxAttempts) {
      iceConnectionAttempts++;
      console.log(`Retrying ICE connection... Attempt ${iceConnectionAttempts}`);
      await initializeConnection();
    } else {
      console.error("Max ICE connection attempts reached. Connection failed.");
      await closePC();
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`ICE connection state: ${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "disconnected") {
      console.log("ICE connection failed. Retrying...");
      retryIceConnection();
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      axios
        .post("http://localhost:3000/send-candidate", {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sessionId: sessionId,
          streamId: streamId,
        })
        .catch((error) => console.error("Error sending ICE candidate:", error));
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (videoRef.current && stream.getVideoTracks().length > 0) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch((error) => console.error("Error playing video:", error));
      };
    }
  };

  const initializeConnection = async () => {
    try {
      const {
        data: { sdpOffer, transportOptions, sessionId: fetchedSessionId, streamId: fetchedStreamId },
      } = await axios.post("http://localhost:3000/api/webrtc/initialize-session");

      sessionId = fetchedSessionId;
      streamId = fetchedStreamId;

      const offer = new RTCSessionDescription({ type: "offer", sdp: sdpOffer });
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await axios.post("http://localhost:3000/complete-sdp", {
        streamId: streamId,
        sessionId: sessionId,
        answer: answer.sdp,
      });
    } catch (error) {
      console.error("Error setting up WebRTC connection:", error);
      retryIceConnection();
    }
  };

  try {
    await initializeConnection();
  } catch (error) {
    console.error("Error initializing connection:", error);
    await closePC();
  }
};

export const closePC = async () => {
  if (pc) {
    pc.close();
    pc = null;
  }
};
