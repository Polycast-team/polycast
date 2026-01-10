import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing YouTube IFrame Player API
 * Handles player initialization, playback controls, and time updates
 */
export function useYouTubePlayer(videoId, onTimeUpdate) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timeUpdateIntervalRef = useRef(null);

  // Keep onTimeUpdateRef in sync with onTimeUpdate prop
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      return; // Already loaded
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('[YouTube] IFrame API loaded');
    };
  }, []);

  // Initialize player when videoId changes
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    const initPlayer = () => {
      // Destroy existing player
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          cc_load_policy: 0, // Hide native captions (we'll use our own)
          iv_load_policy: 3, // Hide annotations
        },
        events: {
          onReady: (event) => {
            console.log('[YouTube] Player ready');
            setIsReady(true);
            setDuration(event.target.getDuration() || 0);
            // Start paused time updates since player starts paused by default
            startPausedTimeUpdates();
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startTimeUpdates();
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              startPausedTimeUpdates(); // Keep updating (slowly) when paused for accurate highlighting
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              stopTimeUpdates();
            }
          },
          onError: (event) => {
            console.error('[YouTube] Player error:', event.data);
          },
        },
      });
    };

    // Wait for YouTube API to load
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }

    return () => {
      stopTimeUpdates();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Time update loop - runs when playing for smooth subtitle sync
  const startTimeUpdates = useCallback(() => {
    console.log('[YouTube] Starting time updates');
    stopTimeUpdates();
    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime() || 0;
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);
      }
    }, 100); // Update every 100ms for smooth subtitle sync
  }, []);

  // Slower time update loop for when paused (to keep highlighting in sync after seeks)
  const startPausedTimeUpdates = useCallback(() => {
    console.log('[YouTube] Starting paused time updates');
    stopTimeUpdates();
    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime() || 0;
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);
      }
    }, 500); // Update every 500ms when paused (less frequent)
  }, []);

  const stopTimeUpdates = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  // Playback controls
  const play = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    }
  }, []);

  const pause = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((seconds, allowSeekAhead = true) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, allowSeekAhead);

      // Immediately update with requested time
      setCurrentTime(seconds);
      onTimeUpdateRef.current?.(seconds);

      // After a brief delay, get the actual current time from the player
      // to ensure highlighting is accurate (YouTube may not seek to exact time)
      setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const actualTime = playerRef.current.getCurrentTime() || seconds;
          setCurrentTime(actualTime);
          onTimeUpdateRef.current?.(actualTime);
        }
      }, 100);
    }
  }, []);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimeUpdates();
    };
  }, [stopTimeUpdates]);

  return {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration,
    isFullscreen,
    play,
    pause,
    togglePlay,
    seekTo,
    toggleFullscreen,
    exitFullscreen,
  };
}
