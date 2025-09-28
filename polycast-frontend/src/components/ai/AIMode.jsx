import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from '../WordDefinitionPopup';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../../utils/profileLanguageMapping';
import { extractSentenceWithWord } from '../../utils/wordClickUtils';
import tokenizeText from '../../utils/tokenizeText';
import aiService from '../../services/aiService';
import apiService from '../../services/apiService';
import './AIMode.css';
import VoiceMode from './VoiceMode';

const DEFAULT_SYSTEM_PROMPT_TEMPLATE = 'You are Polycast AI, an AI language tutor. You are speaking in a chat interface with a user whose native language is {nativeLanguage} and target language is {targetLanguage}. Your goal is to make conversation with the user. The user should not be required to steer the course of the conversation. Take initiative to guide the conversation. Make sure your responses are conversational and concise.';

function AIMode({
  selectedProfile,
  selectedWords,
  wordDefinitions,
  setWordDefinitions,
  onAddWord,
}) {
  const ui = getUITranslationsForProfile(selectedProfile);
  const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
  const targetLanguage = getLanguageForProfile(selectedProfile);

  const systemPrompt = useMemo(() => {
    if (!nativeLanguage || !targetLanguage) {
      throw new Error('AIMode requires both nativeLanguage and targetLanguage to build system prompt');
    }
    return DEFAULT_SYSTEM_PROMPT_TEMPLATE
      .replace(/\{nativeLanguage\}/g, nativeLanguage)
      .replace(/\{targetLanguage\}/g, targetLanguage);
  }, [nativeLanguage, targetLanguage]);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: ui?.aiWelcome || "Hi! I'm Polycast AI. Ask me anything and tap words to explore them.",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [error, setError] = useState('');
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

  const scrollContainerRef = useRef(null);
  const conversationForApi = useMemo(() => (
    messages.map(({ role, content }) => ({ role, content }))
  ), [messages]);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => [...prev, { ...message, id: `${message.role}-${Date.now()}` }]);
  }, []);

  const focusInput = useCallback(() => {
    const el = scrollContainerRef.current?.querySelector('textarea');
    if (el) el.focus();
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

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

    setLoadingDefinition(true);
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
    } finally {
      setLoadingDefinition(false);
    }
  }, [nativeLanguage, setWordDefinitions, targetLanguage]);

  const renderClickableTokens = useCallback((text, keyPrefix) => {
    const tokens = tokenizeText(text);
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
            color: isWord ? '#dbeafe' : undefined,
            background: isWord && isSelected ? 'rgba(59,130,246,0.2)' : undefined,
            borderRadius: isWord && isSelected ? 4 : undefined,
            padding: isWord && isSelected ? '0 2px' : undefined,
          }}
        >
          {token}
        </span>
      );
    });
  }, [handleWordClick, selectedWords]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      focusInput();
      return;
    }

    setIsSending(true);
    setIsAwaitingResponse(true);
    setError('');
    const userMessage = { role: 'user', content: trimmed };
    appendMessage(userMessage);
    setInputValue('');

    try {
      const response = await aiService.sendChat({
        messages: [...conversationForApi, userMessage],
        systemPrompt,
      });
      if (response?.message?.content) {
        appendMessage({ role: 'assistant', content: response.message.content });
      } else {
        throw new Error('Empty response from AI');
      }
    } catch (err) {
      console.error('[AIMode] chat error', err);
      setError(err?.message || 'Failed to get response');
    } finally {
      setIsSending(false);
      setIsAwaitingResponse(false);
      focusInput();
    }
  }, [appendMessage, conversationForApi, focusInput, inputValue, systemPrompt]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const isWordInDictionary = useCallback((word) => (
    Object.values(wordDefinitions || {}).some(
      (entry) => entry && entry.inFlashcards && entry.word === (word || '').toLowerCase(),
    )
  ), [wordDefinitions]);

  return (
    <div className="ai-mode-container" ref={scrollContainerRef}>
      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={isWordInDictionary(popupInfo.word)}
          onAddToDictionary={() => onAddWord && onAddWord(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          loading={loadingDefinition}
          nativeLanguage={nativeLanguage}
          onClose={() => setPopupInfo((prev) => ({ ...prev, visible: false }))}
        />
      )}

      <div className="ai-messages-pane">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`ai-message ai-message-${message.role}`}
        >
            <div className="ai-message-author">
              {message.role === 'assistant' ? 'Polycast AI' : ui.youLabel || 'You'}
            </div>
            <div className="ai-message-text">
              {renderClickableTokens(message.content, message.id)}
            </div>
          </div>
      ))}

      {isAwaitingResponse && (
        <div className="ai-typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      </div>

      {error && (
        <div className="ai-error-banner">{error}</div>
      )}

      <div className="ai-input-bar">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={ui?.aiInputPlaceholder || 'Ask Polycast AI…'}
          rows={3}
        />
        <div className="ai-input-actions">
          <button
            className="ai-voice-button"
            onClick={() => setIsVoiceModeOpen(true)}
            title="Open voice assistant"
          >
            🎙️
          </button>
          <button
            className="ai-send-button"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? ui?.sending || 'Sending…' : ui?.send || 'Send'}
          </button>
        </div>
      </div>

      {isVoiceModeOpen && (
        <VoiceMode
          selectedProfile={selectedProfile}
          onClose={() => setIsVoiceModeOpen(false)}
          baseInstructions={systemPrompt}
          onAddWord={onAddWord}
          selectedWords={selectedWords}
          wordDefinitions={wordDefinitions}
          setWordDefinitions={setWordDefinitions}
        />
      )}
    </div>
  );
}

AIMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  selectedWords: PropTypes.array.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  onAddWord: PropTypes.func,
};

export default AIMode;
