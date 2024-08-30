import React, { useEffect, useRef } from "react";
import { connectionSetup, closePC } from "./webrtc";

const StreamPlayer = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    const initializeStream = async () => {
      try {
        await connectionSetup(videoRef);
      } catch (error) {
        console.error("Error initializing stream:", error);
        await closePC();
      }
    };

    initializeStream();

    return () => {
      closePC();
    };
  }, []);

  return (
    <div>
      <h1>D-ID Stream</h1>
      <video ref={videoRef} id="talkVideo" controls autoPlay muted style={{ width: "100%" }} />
    </div>
  );
};

export default StreamPlayer;
