import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../utils/profileLanguageMapping';
import apiService from '../services/apiService.js';
import config from '../config/config.js';
import { extractSentenceWithWord } from '../utils/wordClickUtils';

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
  defaultFontSize,
  compactLines = false,
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
  const [fontSize, setFontSize] = useState(() => defaultFontSize || 30);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [popupInfo, setPopupInfo] = useState({
    visible: false,
    word: '',
    position: { x: 0, y: 0 }
  });
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const ui = getUITranslationsForProfile(selectedProfile);

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
        const el = scrollContainerRef.current;
        if (el) {
          // Jump directly to the bottom to avoid bounce while new text streams in
          el.scrollTop = el.scrollHeight;
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

  const handleWordClick = async (word, event, wordInstanceIndex = 0) => {
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
    
    // Use UNIFIED API for fetching definition
    setLoadingDefinition(true);
    try {
      const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
      const targetLanguage = getLanguageForProfile(selectedProfile);
      
      // Extract sentence and mark the clicked instance
      const sentence = extractSentenceWithWord(fullTranscript, word);
      
      // Mark the specific clicked instance of the word
      let currentIndex = 0;
      const sentenceWithMarkedWord = sentence.replace(
        new RegExp(`\\b(${word})\\b`, 'gi'),
        (match) => {
          if (currentIndex === wordInstanceIndex) {
            currentIndex++;
            return `~${match}~`;
          }
          currentIndex++;
          return match;
        }
      );
      
      console.log(`[TranscriptionDisplay] Using unified API for word: "${word}", instance: ${wordInstanceIndex}`);
      console.log(`[TranscriptionDisplay] Sentence with marked word:`, sentenceWithMarkedWord);
      
      const url = apiService.getUnifiedWordDataUrl(
        word,
        sentenceWithMarkedWord,
        nativeLanguage,
        targetLanguage
      );
      
      const unifiedData = await apiService.fetchJson(url);
      
      // Store unified data in wordDefinitions for popup display
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: {
          ...unifiedData,
          // Ensure compatibility with popup expectations
          word: word,
          translation: unifiedData.translation || word,
          contextualExplanation: unifiedData.definition || 'Definition unavailable',
          definition: unifiedData.definition || 'Definition unavailable',
          example: unifiedData.exampleForDictionary || unifiedData.example || '',
          frequency: unifiedData.frequency || 5
        }
      }));
    } catch (error) {
      console.error('Error fetching word definition with unified API:', error);
      // Fallback data
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: {
          word: word,
          translation: word,
          contextualExplanation: 'Definition unavailable',
          definition: 'Definition unavailable',
          example: `~${word}~`
        }
      }));
    } finally {
      setLoadingDefinition(false);
    }
  };

  // Track word instance counts for proper marking
  const wordInstanceCounts = useRef({});
  
  const renderClickableWord = (word, index, isPartial = false) => {
    const isWord = /^[\p{L}\p{M}\d']+$/u.test(word);
    const isSelected = selectedWords.some(w => w.toLowerCase() === word.toLowerCase());
    
    // Track which instance of this word we're rendering
    let wordInstanceIndex = 0;
    if (isWord && !isPartial) {
      const wordLower = word.toLowerCase();
      if (!wordInstanceCounts.current[wordLower]) {
        wordInstanceCounts.current[wordLower] = 0;
      }
      wordInstanceIndex = wordInstanceCounts.current[wordLower];
      wordInstanceCounts.current[wordLower]++;
    }
    
    return (
      <span
        key={`${index}-${word}`}
        onClick={isWord && !isPartial ? (e) => handleWordClick(word, e, wordInstanceIndex) : undefined}
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
    // Reset word instance counter for each render
    wordInstanceCounts.current = {};
    
    const sentences = splitIntoSentences(fullTranscript);
    // Decide if currentPartial should render on a NEW line immediately,
    // based on whether the last committed line is "closed" (contains a long
    // sentence >3 words or already grouped 3 short sentences).
    const shouldPartialStartNewLine = (() => {
      if (!currentPartial) return false;
      if (sentences.length === 0) return false; // handled separately below
      const lastLine = sentences[sentences.length - 1] || '';
      // Split lastLine back into simple sentences using punctuation pairs
      const parts = lastLine.split(/([.!?])/);
      const simple = [];
      for (let i = 0; i < parts.length; i += 2) {
        const textPart = (parts[i] || '').trim();
        const punct = parts[i + 1] || '';
        const full = (textPart + punct).trim();
        if (full) simple.push(textPart);
      }
      const numSimple = simple.length;
      const hasLong = simple.some(s => (s.trim().split(/\s+/).filter(Boolean).length) > 3);
      return hasLong || numSimple >= 3;
    })();
    
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
                {isLastSentence && currentPartial && !shouldPartialStartNewLine && (
                  <>
                    {' '}
                    {tokenizeText(currentPartial).map((token, idx) => 
                      renderClickableWord(token, `partial-${idx}`, true)
                    )}
                  </>
                )}
              </div>
              {sentIdx < sentences.length - 1 && !compactLines && (
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
        {/* Or render currentPartial as its own new line if the last line is closed */}
        {sentences.length > 0 && currentPartial && shouldPartialStartNewLine && (
          <div style={{ marginBottom: '10px' }}>
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
          nativeLanguage={getNativeLanguageForProfile(selectedProfile)}
          onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
        />
      )}
      
      {/* Transcript Box */}
      {showLiveTranscript && (
        <div style={{ width: '100%', flex: showTranslation ? '0 0 33.5%' : '1 1 100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              width: '100%',
              flex: 1,
              overflow: 'hidden',
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
              minHeight: 0
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
              {ui.transcriptHeader}
            </span>
            <div 
              ref={scrollContainerRef}
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                overflowX: 'hidden',
                scrollBehavior: 'smooth',
                overscrollBehavior: 'contain'
              }}
              className="pc-transcript-scroll"
              onWheel={(e) => { e.stopPropagation(); }}
              onTouchMove={(e) => { e.stopPropagation(); }}
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
                  {isStudentMode ? (studentHomeLanguage || ui.studentLanguage) : lang}
                </span>
                <p style={{ fontSize: 16, opacity: 0.7, textAlign: 'center' }}>
                  {ui.translationDisabled}
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
  defaultFontSize: PropTypes.number,
  compactLines: PropTypes.bool,
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