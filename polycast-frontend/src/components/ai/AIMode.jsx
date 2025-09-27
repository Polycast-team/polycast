import React, { useState, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from '../WordDefinitionPopup.jsx';
import VoiceSessionPanel from './VoiceSessionPanel.jsx';
import apiService from '../../services/apiService.js';
import aiService from '../../services/aiService.js';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../../utils/profileLanguageMapping.js';
import { extractSentenceWithWord, markWordByIndex } from '../../utils/wordClickUtils.js';
import './AIMode.css';

const WORD_TOKEN_REGEX = /([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu;

const tokenizeText = (text = '') => text.match(WORD_TOKEN_REGEX) || [];

function AIMode({
  selectedProfile,
  onAddWord,
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions,
  onAppendConversation,
}) {
  const ui = getUITranslationsForProfile(selectedProfile);
  const nativeLanguage = useMemo(() => getNativeLanguageForProfile(selectedProfile), [selectedProfile]);
  const targetLanguage = useMemo(() => getLanguageForProfile(selectedProfile), [selectedProfile]);

  const initialMessage = useMemo(() => ({
    id: 'assistant-initial',
    role: 'assistant',
    content: ui.aiWelcomeMessage || 'Hi! I am the Polycast AI tutor. Ask me anything about language learning, and tap words for definitions.',
  }), [ui]);

  const [messages, setMessages] = useState([initialMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 }, definition: null });
  const [loadingDefinition, setLoadingDefinition] = useState(false);

  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceKey, setVoiceKey] = useState(0);

  const chatContainerRef = useRef(null);

  const systemPrompt = useMemo(() => (
    `You are Polycast AI, an energetic GPT-5 language tutor. Respond in clear, concise paragraphs using the target language when appropriate, but provide quick English glosses when needed. Keep responses tight so individual words remain clickable. Highlight key vocabulary with short explanations. Respect the student's native language (${nativeLanguage}) and primary target language (${targetLanguage}).`
  ), [nativeLanguage, targetLanguage]);

  const scrollChatToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleWordClick = useCallback(async (word, event, fullText, wordIndex = 0) => {
    if (!event || !word) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popupWidth = 380;
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    const xPos = fitsOnRight ? rect.right : rect.left - popupWidth;

    setPopupInfo(prev => ({
      ...prev,
      visible: true,
      word,
      position: {
        x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)),
        y: rect.top - 10,
      },
      definition: null,
    }));
    setLoadingDefinition(true);

    try {
      const sentence = extractSentenceWithWord(fullText, word);
      const sentenceWithMark = markWordByIndex(sentence, word, wordIndex);
      const url = apiService.getQuickWordDataUrl(word, sentenceWithMark, nativeLanguage, targetLanguage);
      const definition = await apiService.fetchJson(url);
      setPopupInfo(prev => ({
        ...prev,
        definition,
      }));
    } catch (err) {
      console.error('[AI Mode] popup definition error:', err);
      setErrorMessage(err?.message || 'Failed to load definition.');
    } finally {
      setLoadingDefinition(false);
    }
  }, [nativeLanguage, targetLanguage]);

  const renderTokenizedText = useCallback((text = '', messageId) => {
    const tokens = tokenizeText(text);
    const wordCounts = new Map();

    return tokens.map((token, index) => {
      const isWord = /[\p{L}\p{M}\d']/u.test(token.trim());
      if (!isWord) {
        return <span key={`${messageId}-token-${index}`}>{token}</span>;
      }

      const lowered = token.toLowerCase();
      const occurrence = wordCounts.get(lowered) || 0;
      wordCounts.set(lowered, occurrence + 1);

      return (
        <span
          key={`${messageId}-token-${index}`}
          className="ai-token-word"
          onClick={(event) => handleWordClick(token, event, text, occurrence)}
        >
          {token}
        </span>
      );
    });
  }, [handleWordClick]);

  const closePopup = useCallback(() => {
    setPopupInfo(prev => ({ ...prev, visible: false }));
  }, []);

  const appendMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
    onAppendConversation?.(message);
    scrollChatToBottom();
  }, [onAppendConversation, scrollChatToBottom]);

  const updateAssistantPlaceholder = useCallback((id, content) => {
    setMessages(prev => prev.map(msg => (msg.id === id ? { ...msg, content } : msg)));
  }, []);

  const handleSend = useCallback(async (event) => {
    event?.preventDefault?.();
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    setErrorMessage('');
    setIsSending(true);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantPlaceholder = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '…',
      pending: true,
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setInputValue('');
    scrollChatToBottom();

    try {
      const payloadMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
      const response = await aiService.sendAiChatRequest({
        messages: payloadMessages,
        systemPrompt,
        temperature: 0.45,
        verbosity: 'low',
        model: 'gpt-5-mini',
        maxOutputTokens: 900,
      });

      const assistantText = response?.message || 'I had trouble generating a response. Try again?';

      setMessages(prev => prev.map((msg) => {
        if (msg.id === assistantPlaceholder.id) {
          return { ...msg, content: assistantText, pending: false };
        }
        return msg;
      }));

      onAppendConversation?.({ id: assistantPlaceholder.id, role: 'assistant', content: assistantText });
    } catch (err) {
      console.error('[AI Mode] chat error:', err);
      setErrorMessage(err?.message || 'Unable to reach the AI tutor.');
      setMessages(prev => prev.filter(msg => msg.id !== assistantPlaceholder.id));
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, messages, onAppendConversation, scrollChatToBottom, systemPrompt]);

  const toggleVoicePanel = useCallback(() => {
    setShowVoicePanel(prev => {
      const next = !prev;
      if (next) {
        setVoiceKey(Date.now());
      }
      return next;
    });
  }, []);

  const handleVoiceMessageComplete = useCallback((message) => {
    if (!message?.content) return;
    const messageWithId = {
      id: `${message.role}-${Date.now()}`,
      role: message.role,
      content: message.content,
    };
    appendMessage(messageWithId);
  }, [appendMessage]);

  return (
    <div className="ai-mode-container">
      <div className="ai-mode-header">
        <div>
          <h2>AI Tutor</h2>
          <p>{ui.aiModeSubheading || 'Chat or speak with Polycast AI. Tap words for instant definitions.'}</p>
        </div>
        <button className="ai-voice-toggle" onClick={toggleVoicePanel}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1v22" />
            <path d="M5 8c0 4.5 3 8 7 8s7-3.5 7-8" />
            <path d="M2 11h4" />
            <path d="M18 11h4" />
          </svg>
          {showVoicePanel ? 'Hide voice' : 'Voice mode'}
        </button>
      </div>

      <div className="ai-chat-window" ref={chatContainerRef}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`ai-chat-bubble ${message.role === 'user' ? 'user' : 'assistant'} ${message.pending ? 'pending' : ''}`}
          >
            <div className="ai-chat-role">{message.role === 'user' ? ui.you || 'You' : 'Polycast AI'}</div>
            <div className="ai-chat-content">
              {renderTokenizedText(message.content, message.id)}
            </div>
          </div>
        ))}
      </div>

      <form className="ai-chat-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder={ui.aiPromptPlaceholder || 'Type your question, then press Enter.'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !inputValue.trim()}>
          {isSending ? ui.sending || 'Sending…' : ui.send || 'Send'}
        </button>
      </form>

      {errorMessage && (
        <div className="ai-error-banner">
          {errorMessage}
        </div>
      )}

      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={popupInfo.definition}
          dictDefinition={wordDefinitions?.[popupInfo.word?.toLowerCase?.() || '']}
          position={popupInfo.position}
          loading={loadingDefinition}
          nativeLanguage={nativeLanguage}
          onAddToDictionary={() => onAddWord?.(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          isInDictionary={selectedWords?.some(word => word.toLowerCase() === popupInfo.word?.toLowerCase())}
          onClose={closePopup}
        />
      )}

      <VoiceSessionPanel
        key={voiceKey}
        open={showVoicePanel}
        onClose={() => setShowVoicePanel(false)}
        selectedProfile={selectedProfile}
        nativeLanguage={nativeLanguage}
        targetLanguage={targetLanguage}
        renderTokenizedText={renderTokenizedText}
        onWordClick={handleWordClick}
        onMessageComplete={handleVoiceMessageComplete}
        systemInstructions={systemPrompt}
      />
    </div>
  );
}

AIMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  onAddWord: PropTypes.func,
  selectedWords: PropTypes.arrayOf(PropTypes.string),
  setSelectedWords: PropTypes.func,
  wordDefinitions: PropTypes.object,
  setWordDefinitions: PropTypes.func,
  onAppendConversation: PropTypes.func,
};

export default AIMode;
