import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile, getNativeLanguageForProfile } from '../utils/profileLanguageMapping';
import apiService from '../services/apiService.js';
import { extractSentenceWithWord } from '../utils/wordClickUtils';

// Tokenize words/punctuation/spaces (same pattern used elsewhere)
const tokenizeText = (text) => text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];

function ChatTranscript({
  fullTranscript = '',
  currentPartial = '',
  transcriptBlocks = [],
  selectedProfile = 'joshua',
  roomSetup,
  selectedWords = [],
  setSelectedWords,
  wordDefinitions = {},
  setWordDefinitions,
  onAddWord,
}) {
  const scrollContainerRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });
  const [loadingDefinition, setLoadingDefinition] = useState(false);

  // Phase 1 speaker inference: host streams audio; students view host text
  const speaker = useMemo(() => {
    const isHost = !!(roomSetup && roomSetup.isHost);
    return {
      id: 'me',
      displayName: selectedProfile || 'You',
      isLocal: true,
    };
  }, [roomSetup, selectedProfile]);

  // Auto-scroll behavior: only when user is at bottom
  const isAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return false;
    const threshold = 10;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  };
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => setIsUserScrolling(!isAtBottom());
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!isUserScrolling || isAtBottom()) {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setIsUserScrolling(false);
      }
    }, 40);
    return () => clearTimeout(timeoutId);
  }, [fullTranscript, currentPartial, isUserScrolling]);

  // Font size events (reuse existing global event)
  useEffect(() => {
    const handler = (e) => setFontSize((v) => Math.max(12, Math.min(60, v + (e.detail || 0))));
    window.addEventListener('changeFontSize', handler);
    return () => window.removeEventListener('changeFontSize', handler);
  }, []);

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
      word,
      position: { x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)), y: rect.top - 5 }
    });

    setLoadingDefinition(true);
    try {
      const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
      const targetLanguage = getLanguageForProfile(selectedProfile);
      const sentence = extractSentenceWithWord(fullTranscript || '', word);
      const sentenceWithMarkedWord = sentence.replace(new RegExp(`\\b(${word})\\b`, 'i'), '~$1~');
      const url = apiService.getUnifiedWordDataUrl(word, sentenceWithMarkedWord, nativeLanguage, targetLanguage);
      const unifiedData = await apiService.fetchJson(url);
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: {
          ...unifiedData,
          word: word,
          translation: unifiedData.translation || word,
          contextualExplanation: unifiedData.definition || 'Definition unavailable',
          definition: unifiedData.definition || 'Definition unavailable',
          example: unifiedData.exampleForDictionary || unifiedData.example || '',
          frequency: unifiedData.frequency || 5
        }
      }));
    } catch (err) {
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

  const renderClickableWord = (token, key, isPartial = false) => {
    const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
    const isSelected = isWord && selectedWords.some(w => w.toLowerCase() === token.toLowerCase());
    return (
      <span
        key={key}
        onClick={isWord && !isPartial ? (e) => handleWordClick(token, e) : undefined}
        style={{
          cursor: isWord && !isPartial ? 'pointer' : 'default',
          color: isPartial ? '#22c55e' : (isWord && isSelected ? '#1976d2' : undefined),
          background: isWord && isSelected && !isPartial ? 'rgba(25,118,210,0.07)' : undefined,
          borderRadius: isWord && isSelected && !isPartial ? 3 : undefined,
          transition: 'color 0.2s',
          userSelect: 'text',
        }}
      >
        {token}
      </span>
    );
  };

  const renderHeader = (speakerKey) => {
    const amHost = !!(roomSetup && roomSetup.isHost);
    const isLocal = (speakerKey === 'host' && amHost) || (speakerKey === 'student' && !amHost);
    const displayName = isLocal ? selectedProfile : (speakerKey === 'host' ? 'Host' : 'Student');
    return (
      <div style={{ padding: '12px 16px 8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c62ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
            <span style={{ fontSize: 12 }}>{(displayName || 'U').slice(0,1).toUpperCase()}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#b3b3e7' }}>
            {displayName}{isLocal ? ' (you)' : ''}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#181b2f',
          color: '#fff',
          borderRadius: 10,
          boxShadow: '0 2px 12px 0 rgba(124,98,255,0.14)',
          borderTop: '6px solid #7c62ff',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable transcript body with grouped headers */}
        <div
          ref={scrollContainerRef}
          className="pc-transcript-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', scrollBehavior: 'smooth', overscrollBehavior: 'contain' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize, lineHeight: 1.6 }}>
            {transcriptBlocks.length > 0 ? (
              transcriptBlocks.map((blk, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {renderHeader(blk.speaker)}
                  <div style={{ padding: '8px 2px 0 2px' }}>
                    {blk.lines.map((line, j) => (
                      <div key={j} style={{ marginBottom: 10 }}>
                        {tokenizeText(line).map((t, k) => renderClickableWord(t, `b${i}-l${j}-t${k}`))}
                      </div>
                    ))}
                    {blk.partial && (
                      <div style={{ marginBottom: 10 }}>
                        {tokenizeText(blk.partial).map((t, k) => renderClickableWord(t, `b${i}-p-${k}`, true))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <>
                {renderHeader('host')}
                <div style={{ padding: '8px 2px 0 2px' }}>
                  {fullTranscript && (
                    <div style={{ marginBottom: 10 }}>
                      {tokenizeText(fullTranscript).map((t, idx) => renderClickableWord(t, `f-${idx}`))}
                    </div>
                  )}
                  {currentPartial && (
                    <div style={{ marginBottom: 10 }}>
                      {tokenizeText(currentPartial).map((t, idx) => renderClickableWord(t, `p-${idx}`, true))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div style={{ height: 1 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

ChatTranscript.propTypes = {
  fullTranscript: PropTypes.string,
  currentPartial: PropTypes.string,
  transcriptBlocks: PropTypes.array,
  selectedProfile: PropTypes.string,
  roomSetup: PropTypes.object,
  selectedWords: PropTypes.array,
  setSelectedWords: PropTypes.func,
  wordDefinitions: PropTypes.object,
  setWordDefinitions: PropTypes.func,
  onAddWord: PropTypes.func,
};

export default ChatTranscript;


