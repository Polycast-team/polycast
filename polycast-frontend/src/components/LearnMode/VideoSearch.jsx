import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import apiService from '../../services/apiService.js';
import './LearnMode.css';

// Default search queries by language for initial recommendations
const DEFAULT_QUERIES = {
  es: 'noticias en español',
  fr: 'actualités en français',
  de: 'nachrichten auf deutsch',
  it: 'notizie in italiano',
  pt: 'notícias em português',
  ja: '日本語 ニュース',
  ko: '한국어 뉴스',
  zh: '中文 新闻',
  ru: 'новости на русском',
  ar: 'أخبار عربية',
  hi: 'हिंदी समाचार',
  en: 'english learning',
};

function VideoSearch({ targetLanguage, onVideoSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isRecommended, setIsRecommended] = useState(true);
  const initialLoadDone = useRef(false);

  const searchVideos = useCallback(async (query, pageToken = null, isInitial = false) => {
    if (!query || !query.trim()) return;

    setIsLoading(true);
    if (!isInitial) setError(null);

    try {
      const data = await apiService.searchYouTubeVideos(
        query.trim(),
        targetLanguage || 'en',
        pageToken,
        12
      );

      if (pageToken) {
        setVideos(prev => [...prev, ...(data.videos || [])]);
      } else {
        setVideos(data.videos || []);
      }

      setNextPageToken(data.nextPageToken || null);
      setHasSearched(true);
      if (!isInitial) setError(null);
    } catch (err) {
      console.error('[VideoSearch] Error:', err);
      // Only show error for user-initiated searches, not initial load
      if (!isInitial) {
        setError(err.message || 'Failed to search videos');
      }
    } finally {
      setIsLoading(false);
    }
  }, [targetLanguage]);

  // Auto-load recommended videos on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const defaultQuery = DEFAULT_QUERIES[targetLanguage] || DEFAULT_QUERIES.en;
    searchVideos(defaultQuery, null, true);
  }, [targetLanguage, searchVideos]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setIsRecommended(false);
    searchVideos(searchQuery, null, false);
  }, [searchQuery, searchVideos]);

  const handleLoadMore = useCallback(() => {
    if (nextPageToken && !isLoading) {
      searchVideos(searchQuery, nextPageToken, false);
    }
  }, [nextPageToken, isLoading, searchQuery, searchVideos]);

  const formatDuration = (isoDuration) => {
    if (!isoDuration) return '';
    // Parse ISO 8601 duration (e.g., PT4M13S)
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';

    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const seconds = match[3] ? parseInt(match[3], 10) : 0;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const getCaptionBadge = (captionType) => {
    if (captionType === 'human') {
      return <span className="caption-badge human">CC</span>;
    } else if (captionType === 'auto') {
      return <span className="caption-badge auto">Auto</span>;
    }
    return <span className="caption-badge unknown">?</span>;
  };

  return (
    <div className="video-search">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search videos in ${targetLanguage || 'target language'}...`}
          className="search-input"
        />
        <button
          type="submit"
          disabled={isLoading || !searchQuery.trim()}
          className="search-button"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="search-error">
          {error}
        </div>
      )}

      {/* Loading state for initial recommendations */}
      {isLoading && videos.length === 0 && (
        <div className="video-loading">
          <div className="loading-spinner"></div>
          <span>Loading recommended videos...</span>
        </div>
      )}

      {/* Section header */}
      {videos.length > 0 && (
        <h3 className="video-section-header">
          {isRecommended ? 'Recommended for You' : 'Search Results'}
        </h3>
      )}

      {videos.length > 0 && (
        <div className="video-grid">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="video-card"
              onClick={() => onVideoSelect(video)}
            >
              <div className="video-thumbnail-container">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="video-thumbnail"
                />
                {video.duration && (
                  <span className="video-duration">
                    {formatDuration(video.duration)}
                  </span>
                )}
                {getCaptionBadge(video.captionType)}
              </div>
              <div className="video-info">
                <h3 className="video-title" title={video.title}>
                  {video.title}
                </h3>
                <p className="video-channel">{video.channelTitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasSearched && videos.length === 0 && !isLoading && (
        <div className="no-results">
          No videos found with subtitles. Try a different search.
        </div>
      )}

      {nextPageToken && videos.length > 0 && (
        <button
          onClick={handleLoadMore}
          disabled={isLoading}
          className="load-more-button"
        >
          {isLoading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

VideoSearch.propTypes = {
  targetLanguage: PropTypes.string,
  onVideoSelect: PropTypes.func.isRequired,
};

export default VideoSearch;
