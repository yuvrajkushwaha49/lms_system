import { useMemo, useRef, useState } from "react";
import {
  FiMaximize2,
  FiPause,
  FiPlay,
  FiSettings,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";

const VIDEO_PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

const formatVideoTime = (value) => {
  const seconds = Number.isFinite(value) ? Math.max(Math.floor(value), 0) : 0;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const preventProtectedMediaAction = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const protectedMediaHandlers = {
  onContextMenu: preventProtectedMediaAction,
  onDragStart: preventProtectedMediaAction,
};

export default function CommunityVideoPlayer({
  src,
  title = "Video",
  compact = false,
  variants = [],
  autoQualityLabel = "Auto",
  className = "",
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const pendingSeekRef = useRef(0);
  const shouldResumeRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState("main");

  const qualityOptions = useMemo(() => {
    const readyVariants = (variants || [])
      .filter((variant) => variant.status === "ready" && variant.media_url)
      .map((variant) => ({
        value: variant.resolution,
        label: variant.resolution,
        src: variant.media_url,
      }));
    return [{ value: "auto", label: autoQualityLabel, src }, ...readyVariants];
  }, [src, variants, autoQualityLabel]);

  const selectedSource = qualityOptions.find((option) => option.value === selectedQuality) || qualityOptions[0];
  const selectedQualityLabel = selectedSource?.label || autoQualityLabel;
  const selectedSpeedLabel = playbackRate === 1 ? "Normal" : `${playbackRate}x`;

  const togglePlayback = (event) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleSeek = (event) => {
    event.stopPropagation();
    const nextTime = Number(event.target.value);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolume = (event) => {
    event.stopPropagation();
    const nextVolume = Number(event.target.value);
    if (videoRef.current) {
      videoRef.current.volume = nextVolume;
      videoRef.current.muted = nextVolume === 0;
    }
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const handleSpeedChange = (event, speed) => {
    event.stopPropagation();
    const nextSpeed = Number(speed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
    setSettingsPanel("main");
  };

  const handleQualityChange = (event, quality) => {
    event.stopPropagation();
    const video = videoRef.current;
    pendingSeekRef.current = video?.currentTime || currentTime;
    shouldResumeRef.current = Boolean(video && !video.paused);
    setSelectedQuality(quality);
    setSettingsPanel("main");
  };

  const toggleMute = (event) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const openFullscreen = (event) => {
    event.stopPropagation();
    playerRef.current?.requestFullscreen?.();
  };

  const rootClass = ["student-community-video-player", compact ? "compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={playerRef}
      className={rootClass}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={preventProtectedMediaAction}
    >
      <video
        key={selectedSource?.src || src}
        ref={videoRef}
        src={selectedSource?.src || src}
        className="student-community-video"
        preload="metadata"
        title={title}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        draggable={false}
        {...protectedMediaHandlers}
        onClick={togglePlayback}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          const nextDuration = video.duration || 0;
          const nextTime = Math.min(pendingSeekRef.current || 0, nextDuration || pendingSeekRef.current || 0);
          video.playbackRate = playbackRate;
          if (nextTime > 0) video.currentTime = nextTime;
          setDuration(nextDuration);
          setCurrentTime(nextTime);
          if (shouldResumeRef.current) {
            video.play().catch(() => {});
          } else {
            setIsPlaying(false);
          }
          pendingSeekRef.current = 0;
          shouldResumeRef.current = false;
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {!isPlaying && (
        <button type="button" className="student-community-video-center-play" onClick={togglePlayback} aria-label="Play video">
          <FiPlay />
        </button>
      )}
      <div className="student-community-video-controls">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || currentTime)}
          onChange={handleSeek}
          className="student-community-video-progress"
          aria-label="Video progress"
        />
        <div className="student-community-video-control-row">
          <button type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause video" : "Play video"}>
            {isPlaying ? <FiPause /> : <FiPlay />}
          </button>
          <span className="student-community-video-time">
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>
          <div className="student-community-video-volume">
            <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute video" : "Mute video"}>
              {isMuted || volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolume}
              aria-label="Video volume"
            />
          </div>
          <div className="student-community-video-settings-wrap">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!showSettings) setSettingsPanel("main");
                setShowSettings((prev) => !prev);
              }}
              aria-label="Video settings"
            >
              <FiSettings />
            </button>
            {showSettings && (
              <div className="student-community-video-settings" onClick={(event) => event.stopPropagation()}>
                {settingsPanel === "main" && (
                  <div className="student-community-video-settings-panel">
                    <button type="button" className="student-community-video-settings-row" onClick={() => setSettingsPanel("speed")}>
                      <span>Playback speed</span>
                      <small>{selectedSpeedLabel} &gt;</small>
                    </button>
                    <button type="button" className="student-community-video-settings-row" onClick={() => setSettingsPanel("quality")}>
                      <span>Quality</span>
                      <small>{selectedQualityLabel} &gt;</small>
                    </button>
                  </div>
                )}
                {settingsPanel === "quality" && (
                  <div className="student-community-video-settings-panel">
                    <button type="button" className="student-community-video-settings-back" onClick={() => setSettingsPanel("main")}>
                      &lt; Quality
                    </button>
                    {qualityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`student-community-video-settings-option ${selectedQuality === option.value ? "active" : ""}`}
                        onClick={(event) => handleQualityChange(event, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {settingsPanel === "speed" && (
                  <div className="student-community-video-settings-panel">
                    <button type="button" className="student-community-video-settings-back" onClick={() => setSettingsPanel("main")}>
                      &lt; Playback speed
                    </button>
                    {VIDEO_PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        className={`student-community-video-settings-option ${playbackRate === speed ? "active" : ""}`}
                        onClick={(event) => handleSpeedChange(event, speed)}
                      >
                        {speed === 1 ? "Normal" : `${speed}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={openFullscreen} aria-label="Open fullscreen">
            <FiMaximize2 />
          </button>
        </div>
      </div>
    </div>
  );
}
