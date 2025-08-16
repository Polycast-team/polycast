import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile } from '../utils/profileLanguageMapping';
import apiService from '../services/apiService.js';
import config from '../config/config.js';

// Helper function to tokenize text into words and punctuation
const tokenizeText = (text) => {
  return text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
};

// Helper function to split text into sentences based on punctuation (excluding commas)
// Creates new lines for sentences with more than 3 words OR after 3 complete sentences
const splitIntoSentences = (text) => {
  // Split on sentence-ending punctuation (periods, exclamation, question marks) but NOT commas
  const parts = text.split(/([.!?])/);
  const sentences = [];
  let currentSentence = '';
  let sentencesOnCurrentLine = 0;
  
  for (let i = 0; i < parts.length; i += 2) {
    const textPart = parts[i] || '';
    const punct = parts[i + 1] || '';
    const fullSentence = textPart + punct;
    
    if (fullSentence.trim()) {
      // Count words in this sentence (exclude punctuation and whitespace)
      const words = textPart.trim().split(/\s+/).filter(word => word.length > 0);
      
      if (punct) {
        // This is a complete sentence
        currentSentence += fullSentence;
        sentencesOnCurrentLine++;
        
        // Start new line if: sentence has >3 words OR we've reached 3 sentences on this line
        if (words.length > 3 || sentencesOnCurrentLine >= 3) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
          sentencesOnCurrentLine = 0;
        }
      } else {
        // This sentence has no punctuation - continue on same line
        currentSentence += fullSentence;
      }
    }
  }
  
  // Add any remaining text as the last sentence
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }
  
  return sentences.filter(s => s.trim());
};

/**
 * Displays the real-time transcription with word-by-word updates
 */
const TranscriptionDisplay = ({ 
  showTBA,
  fullTranscript = '',
  currentPartial = '',
  targetLanguages = [], 
  translations = {}, 
  showLiveTranscript = true, 
  showTranslation = true, 
  selectedWords = [],
  setSelectedWords,
  wordDefinitions = {},
  setWordDefinitions,
  isStudentMode = false,
  studentHomeLanguage,
  selectedProfile = 'joshua',
  onAddWord
}) => {
  const transcriptRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [fontSize, setFontSize] = useState(30);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [popupInfo, setPopupInfo] = useState({
    visible: false,
    word: '',
    position: { x: 0, y: 0 }
  });
  const [loadingDefinition, setLoadingDefinition] = useState(false);

  // Check if user is at bottom of scroll container
  const isAtBottom = () => {
    if (!scrollContainerRef.current) return false;
    const element = scrollContainerRef.current;
    const threshold = 10; // Allow 10px margin
    return element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
  };

  // Handle scroll events to detect user scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Check if user manually scrolled away from bottom
      if (!isAtBottom()) {
        setIsUserScrolling(true);
      } else {
        setIsUserScrolling(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when new content arrives (only if user is at bottom)
  useEffect(() => {
    const scrollToBottom = () => {
      // Only auto-scroll if user hasn't manually scrolled up
      if (!isUserScrolling || isAtBottom()) {
        const scrollAnchor = document.querySelector('.scroll-anchor');
        if (scrollAnchor) {
          scrollAnchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        setIsUserScrolling(false);
      }
    };

    // Use setTimeout to ensure DOM has fully updated
    const timeoutId = setTimeout(scrollToBottom, 50);
    
    return () => clearTimeout(timeoutId);
  }, [fullTranscript, currentPartial, isUserScrolling]);

  // Listen for font size change events
  useEffect(() => {
    const handler = (e) => {
      setFontSize(f => {
        const newSize = Math.max(10, Math.min(96, f + (e.detail || 0)));
        const el = document.getElementById('font-size-display');
        if (el) el.textContent = `${newSize}px`;
        return newSize;
      });
    };
    window.addEventListener('changeFontSize', handler);
    const el = document.getElementById('font-size-display');
    if (el) el.textContent = `${fontSize}px`;
    return () => window.removeEventListener('changeFontSize', handler);
  }, [fontSize]);

  const handleWordClick = async (word, event) => {
    if (!event) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popupWidth = 380;
    
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    const xPos = fitsOnRight ? rect.right + 5 : rect.left - popupWidth - 5;
    
    setPopupInfo({
      visible: true,
      word: word,
      position: {
        x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)),
        y: rect.top - 5
      }
    });
    
    // Fetch definition from API
    setLoadingDefinition(true);
    try {
      const targetLanguage = getLanguageForProfile(selectedProfile);
      const contextSentence = fullTranscript; // Use full transcript as context
      const data = await apiService.fetchJson(apiService.getWordPopupUrl(word, contextSentence, targetLanguage));
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: data
      }));
    } catch (error) {
      console.error('Error fetching word definition:', error);
    } finally {
      setLoadingDefinition(false);
    }
  };

  const renderClickableWord = (word, index, isPartial = false) => {
    const isWord = /^[\p{L}\p{M}\d']+$/u.test(word);
    const isSelected = selectedWords.some(w => w.toLowerCase() === word.toLowerCase());
    
    return (
      <span
        key={`${index}-${word}`}
        onClick={isWord && !isPartial ? (e) => handleWordClick(word, e) : undefined}
        style={{
          cursor: isWord && !isPartial ? 'pointer' : 'default',
          color: isPartial ? '#22c55e' : (isWord && isSelected ? '#1976d2' : undefined),
          background: isWord && isSelected && !isPartial ? 'rgba(25,118,210,0.07)' : undefined,
          borderRadius: isWord && isSelected && !isPartial ? 3 : undefined,
          transition: 'color 0.2s',
          userSelect: 'text',
        }}
      >
        {word}
      </span>
    );
  };

  const renderTranscript = () => {
    const sentences = splitIntoSentences(fullTranscript);
    
    return (
      <div style={{ fontSize, lineHeight: 1.6, padding: '20px', minHeight: '100%' }}>
        {sentences.map((sentence, sentIdx) => {
          const tokens = tokenizeText(sentence);
          const isLastSentence = sentIdx === sentences.length - 1;
          
          return (
            <div key={sentIdx}>
              <div style={{ marginBottom: '10px' }}>
                {tokens.map((token, tokenIdx) => 
                  renderClickableWord(token, `${sentIdx}-${tokenIdx}`)
                )}
                {/* Append currentPartial to the last sentence line to avoid jumping */}
                {isLastSentence && currentPartial && (
                  <>
                    {' '}
                    {tokenizeText(currentPartial).map((token, idx) => 
                      renderClickableWord(token, `partial-${idx}`, true)
                    )}
                  </>
                )}
              </div>
              {sentIdx < sentences.length - 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '1px',
                    backgroundColor: 'white',
                    opacity: 0.3
                  }} />
                </div>
              )}
            </div>
          );
        })}
        {/* Only show currentPartial as separate block if there are no sentences yet */}
        {sentences.length === 0 && currentPartial && (
          <div style={{ 
            marginBottom: '10px',
            backgroundColor: 'white',
            padding: '5px 8px',
            borderRadius: '4px',
            color: '#22c55e' // Green text
          }}>
            {tokenizeText(currentPartial).map((token, idx) => 
              renderClickableWord(token, `partial-${idx}`, true)
            )}
          </div>
        )}
        {/* Scroll anchor */}
        <div className="scroll-anchor" style={{ height: '1px', width: '100%' }} />
      </div>
    );
  };

  const colorSchemes = [
    { bg: '#2d2a3a', fg: '#fff', accent: '#7c62ff' },
    { bg: '#1b3a4b', fg: '#fff', accent: '#4ad991' },
    { bg: '#4a2c2a', fg: '#fff', accent: '#ffb86b' },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 244px)',
        margin: '20px auto 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px 24px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Word Definition Popup */}
      {popupInfo.visible && (
        <WordDefinitionPopup 
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={Object.values(wordDefinitions).some(e => e && e.inFlashcards && e.word === (popupInfo.word || '').toLowerCase())}
          onAddToDictionary={() => onAddWord && onAddWord(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          loading={loadingDefinition}
          nativeLanguage={getLanguageForProfile(selectedProfile)}
          onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
        />
      )}
      
      {/* Transcript Box */}
      {showLiveTranscript && (
        <div style={{ width: '100%', flex: showTranslation ? '0 0 33.5%' : '1 1 100%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              width: '100%',
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#181b2f',
              color: '#fff',
              borderTop: '6px solid #7c62ff',
              borderRadius: 10,
              boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.14)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '100%',
              position: 'relative',
            }}
            ref={transcriptRef}
          >
            <span style={{ 
              letterSpacing: 0.5, 
              textAlign: 'center', 
              fontWeight: 800, 
              fontSize: 20, 
              margin: '18px 0 10px 0', 
              color: '#b3b3e7', 
              textTransform: 'uppercase', 
              opacity: 0.92 
            }}>
              Transcript
            </span>
            <div 
              ref={scrollContainerRef}
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                overflowX: 'hidden',
                scrollBehavior: 'smooth'
              }}
            >
              {renderTranscript()}
            </div>
          </div>
        </div>
      )}
      
      {/* Translation Boxes (showing disabled message) */}
      {showTranslation && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            flex: '1 1 66.5%',
            alignItems: 'stretch',
            minHeight: 0,
            gap: 24,
            boxSizing: 'border-box',
            marginTop: 24,
          }}
        >
          {targetLanguages.map((lang, idx) => {
            const scheme = colorSchemes[(idx + 1) % colorSchemes.length];
            return (
              <div
                key={lang}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  maxHeight: '100%',
                  overflow: 'hidden',
                  background: scheme.bg,
                  color: scheme.fg,
                  borderTop: `4px solid ${scheme.accent}`,
                  borderRadius: 12,
                  boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 20,
                }}
              >
                <span style={{
                  letterSpacing: 0.5,
                  fontWeight: 800,
                  fontSize: 20,
                  color: scheme.accent + 'cc',
                  textTransform: 'uppercase',
                  opacity: 0.92,
                  marginBottom: 20,
                }}>
                  {isStudentMode ? (studentHomeLanguage || 'Student Language') : lang}
                </span>
                <p style={{ fontSize: 16, opacity: 0.7, textAlign: 'center' }}>
                  Translation temporarily disabled for streaming mode
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

TranscriptionDisplay.propTypes = {
  showTBA: PropTypes.func,
  fullTranscript: PropTypes.string,
  currentPartial: PropTypes.string,
  targetLanguages: PropTypes.arrayOf(PropTypes.string),
  translations: PropTypes.object,
  showLiveTranscript: PropTypes.bool,
  showTranslation: PropTypes.bool,
  selectedWords: PropTypes.array,
  setSelectedWords: PropTypes.func,
  wordDefinitions: PropTypes.object,
  setWordDefinitions: PropTypes.func,
  isStudentMode: PropTypes.bool,
  studentHomeLanguage: PropTypes.string,
  selectedProfile: PropTypes.string,
  onAddWord: PropTypes.func
};

export default TranscriptionDisplay;