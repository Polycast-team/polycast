import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from '../WordDefinitionPopup';
import tokenizeText from '../../utils/tokenizeText';
import { extractSentenceWithWord } from '../../utils/wordClickUtils';
import { getLanguageForProfile, getNativeLanguageForProfile } from '../../utils/profileLanguageMapping';
import aiService from '../../services/aiService';
import apiService from '../../services/apiService';
import './VoiceMode.css';

const VOICE_DEFAULT_PROMPT = 'Share a short language lesson and ask a quick follow-up question.';

function VoiceMode({
  selectedProfile,
  baseInstructions,
  onClose,
  onAddWord,
  selectedWords,
  wordDefinitions,
  setWordDefinitions,
}) {
  const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
  const targetLanguage = getLanguageForProfile(selectedProfile);

  const [promptValue, setPromptValue] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]); // [{id, role, content}]
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });
  const scrollRef = useRef(null);

  const conversationForApi = useMemo(() => conversation.map(({ role, content }) => ({ role, content })), [conversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation, popupInfo.visible]);

  const isWordInDictionary = useCallback((word) => (
    Object.values(wordDefinitions || {}).some(
      (entry) => entry && entry.inFlashcards && entry.word === (word || '').toLowerCase(),
    )
  ), [wordDefinitions]);

  const handleWordClick = useCallback(async (word, event, surroundingText = '') => {
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
      position: { x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)), y: rect.top - 5 },
    });

    try {
      const sentence = extractSentenceWithWord(surroundingText || word, word);
      const sentenceWithMarkedWord = sentence.replace(new RegExp(`\\b(${word})\\b`, 'i'), '~$1~');
      const url = apiService.getUnifiedWordDataUrl(word, sentenceWithMarkedWord, nativeLanguage, targetLanguage);
      const unifiedData = await apiService.fetchJson(url);
      setWordDefinitions((prev) => ({
        ...prev,
        [word.toLowerCase()]: {
          ...unifiedData,
          word,
          translation: unifiedData.translation || word,
          contextualExplanation: unifiedData.definition || 'Definition unavailable',
          definition: unifiedData.definition || 'Definition unavailable',
          example: unifiedData.exampleForDictionary || unifiedData.example || '',
          frequency: unifiedData.frequency || 5,
        },
      }));
    } catch (err) {
      setWordDefinitions((prev) => ({
        ...prev,
        [word.toLowerCase()]: {
          word,
          translation: word,
          contextualExplanation: 'Definition unavailable',
          definition: 'Definition unavailable',
          example: `~${word}~`,
        },
      }));
    }
  }, [nativeLanguage, setWordDefinitions, targetLanguage]);

  const renderTokens = useCallback((text, keyPrefix) => {
    const tokens = tokenizeText(text || '');
    return tokens.map((token, index) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      const isSelected = isWord && selectedWords.some((w) => w.toLowerCase() === token.toLowerCase());
      const tokenKey = `${keyPrefix}-${index}`;
      return (
        <span
          key={tokenKey}
          onClick={isWord ? (e) => handleWordClick(token, e, text) : undefined}
          style={{
            cursor: isWord ? 'pointer' : 'default',
            color: isWord ? '#fde68a' : undefined,
            background: isWord && isSelected ? 'rgba(253,224,71,0.18)' : undefined,
            borderRadius: isWord && isSelected ? 4 : undefined,
            padding: isWord && isSelected ? '0 2px' : undefined,
          }}
        >
          {token}
        </span>
      );
    });
  }, [handleWordClick, selectedWords]);

  const handleSubmit = useCallback(async () => {
    if (isRequesting) return;
    const trimmed = promptValue.trim();
    if (!trimmed) {
      setError('Please enter a short request before starting voice mode.');
      return;
    }
    setError('');
    setIsRequesting(true);

    const userMessage = { id: `voice-user-${Date.now()}`, role: 'user', content: trimmed };
    setConversation((prev) => [...prev, userMessage]);
    setPromptValue('');

    try {
      const response = await aiService.requestVoiceResponse({
        messages: [...conversationForApi, { role: 'user', content: trimmed }],
        systemPrompt: baseInstructions || VOICE_DEFAULT_PROMPT,
      });

      const { transcript, transcriptSegments = [], audio, format = 'mp3' } = response || {};

      if (audio) {
        const audioUrl = `data:audio/${format};base64,${audio}`;
        const audioElement = new Audio(audioUrl);
        audioElement.play().catch((err) => console.warn('Audio playback failed', err));
      }

      const assistantText = transcript || transcriptSegments.join(' ');
      if (assistantText) {
        setConversation((prev) => [...prev, { id: `voice-assistant-${Date.now()}`, role: 'assistant', content: assistantText }]);
      }
    } catch (err) {
      console.error('[VoiceMode] voice error', err);
      setError(err?.message || 'Failed to generate voice response');
    } finally {
      setIsRequesting(false);
    }
  }, [baseInstructions, conversationForApi, isRequesting, promptValue]);

  return (
    <div className="voice-mode-overlay">
      <div className="voice-mode-panel">
        <div className="voice-mode-header">
          <h2>Polycast Voice</h2>
          <button type="button" className="voice-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="voice-mode-body" ref={scrollRef}>
          {conversation.map((turn) => (
            <div key={turn.id} className={`voice-turn voice-turn-${turn.role}`}>
              <div className="voice-turn-label">{turn.role === 'assistant' ? 'Polycast AI' : 'You'}</div>
              <div className="voice-turn-text">{renderTokens(turn.content, turn.id)}</div>
            </div>
          ))}
        </div>

        {error && <div className="voice-error-banner">{error}</div>}

        <div className="voice-input-bar">
          <textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder="Describe what you want the AI to say..."
            rows={3}
            disabled={isRequesting}
          />
          <div className="voice-actions">
            <button
              type="button"
              className="voice-primary-btn"
              onClick={handleSubmit}
              disabled={isRequesting}
            >
              {isRequesting ? 'Generating…' : 'Speak'}
            </button>
          </div>
        </div>
      </div>

      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={isWordInDictionary(popupInfo.word)}
          onAddToDictionary={() => onAddWord && onAddWord(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          loading={false}
          nativeLanguage={nativeLanguage}
          onClose={() => setPopupInfo((prev) => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}

VoiceMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  baseInstructions: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onAddWord: PropTypes.func,
  selectedWords: PropTypes.array.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
};

VoiceMode.defaultProps = {
  baseInstructions: VOICE_DEFAULT_PROMPT,
  onAddWord: undefined,
};

export default VoiceMode;
