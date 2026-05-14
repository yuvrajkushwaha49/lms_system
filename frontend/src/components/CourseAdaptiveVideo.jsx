import { useEffect, useRef } from "react";
import Hls from "hls.js";

function isHlsUrl(src) {
  return /\.m3u8(\?|$)/i.test(String(src || ""));
}

/**
 * Plays progressive MP4/WebM via native src, or multi-bitrate HLS (.m3u8) via Safari native or hls.js.
 */
export default function CourseAdaptiveVideo({ src, ...videoProps }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!src) {
      video.removeAttribute("src");
      video.load();
      return undefined;
    }

    if (!isHlsUrl(src)) {
      video.src = src;
      return undefined;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return undefined;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 120,
        maxMaxBufferLength: 600,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    video.src = src;
    return undefined;
  }, [src]);

  return <video ref={videoRef} {...videoProps} />;
}
