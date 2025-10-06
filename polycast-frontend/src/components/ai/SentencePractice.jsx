import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile, getProficiencyForProfile } from '../../utils/profileLanguageMapping';
import apiService from '../../services/apiService';
import aiService from '../../services/aiService';
import tokenizeText from '../../utils/tokenizeText';
import WordDefinitionPopup from '../WordDefinitionPopup';
import { getConjugationBundle } from '../../utils/conjugations/index.js';
import { getLanguageCodeForProfile } from '../../utils/profileLanguageMapping';
import './SentencePractice.css';

function SentencePractice({
  selectedProfile,
  selectedWords,
  onBack,
  onAddWord,
}) {
  const ui = getUITranslationsForProfile(selectedProfile);
  const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
  const targetLanguage = getLanguageForProfile(selectedProfile);

  const [currentSentence, setCurrentSentence] = useState('');
  const [userTranslation, setUserTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [ignoreAccents, setIgnoreAccents] = useState(false);
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const [wordDefinitions, setWordDefinitions] = useState({});
  const [explainPopup, setExplainPopup] = useState({ visible: false, position: { x: 0, y: 0 }, oldWord: '', newWord: '', loading: false, response: '', input: '' });
  const [targetWord, setTargetWord] = useState(null);
  const [hintMode, setHintMode] = useState(false);
  const [hintMessage, setHintMessage] = useState('');
  const [showConjugationHelp, setShowConjugationHelp] = useState(false);
  const [selectedTenseKeys, setSelectedTenseKeys] = useState([]);
  const [activeHintIndex, setActiveHintIndex] = useState(null); // single active index
  const [activeHintText, setActiveHintText] = useState('');
  const [clickedHints, setClickedHints] = useState([]); // [{index, word, translation}]
  const [showAddClickedWords, setShowAddClickedWords] = useState(false);

  const generateSentence = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setEvaluationResult(null);
    setUserTranslation('');
    setTargetWord(null);
    // Clear inline hints when moving to a new sentence
    setActiveHintIndex(null);
    setActiveHintText('');
    setHintMessage('');
    setClickedHints([]);
    setShowAddClickedWords(false);

    try {
      // 30% chance to use a dictionary word if available
      const userDictionary = selectedWords || [];
      const shouldUseDictWord = userDictionary.length > 0 && Math.random() < 0.3;
      const targetWordToUse = shouldUseDictWord 
        ? userDictionary[Math.floor(Math.random() * userDictionary.length)]
        : null;

      // Fetch sentence from Gemini via backend (unique per DB)
      const proficiency = window?.pc_profileProficiency?.[selectedProfile] || 3;
      const url = apiService.getPracticeSentenceUrl(nativeLanguage, targetLanguage, targetWordToUse, proficiency);
      const response = await apiService.fetchJson(url);

      if (response?.nativeSentence) {
        setCurrentSentence(response.nativeSentence);
        setTargetWord(response.targetWord || null);
      } else {
        throw new Error('Failed to generate sentence');
      }
    } catch (err) {
      console.error('[SentencePractice] Error generating sentence:', err);
      setError(err?.message || 'Failed to generate sentence');
    } finally {
      setIsLoading(false);
    }
  }, [nativeLanguage, targetLanguage, selectedWords, selectedProfile]);

  const evaluateTranslation = useCallback(async () => {
    if (!userTranslation.trim() || !currentSentence) return;

    setIsEvaluating(true);
    setError('');

    try {
      const prompt = `Evaluate this translation for accuracy and naturalness:

Original sentence (${nativeLanguage}): "${currentSentence}"
User's translation (${targetLanguage}): "${userTranslation}"

Consider the translation CORRECT if:
- The meaning is accurately conveyed
- The grammar is correct
- The translation sounds natural in ${targetLanguage}
- It's a valid way to express the same idea (even if different from other possible translations)

If the translation is correct, respond with: "CORRECT"

If the translation has errors, provide the corrected version using this format:
- For each word that should be replaced, use: --oldWord[newWord]
- Example: "How --is[are] you" means replace "is" with "are"
${ignoreAccents ? '- IMPORTANT: Ignore accent-only differences. If the only difference is diacritics/accents, consider it CORRECT and do not mark with --old[new].' : ''}

Be flexible and recognize that there are often multiple correct ways to translate the same sentence.

Return only the evaluation result.`;

      const level = getProficiencyForProfile(selectedProfile);
      const response = await aiService.sendChat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: `You are a helpful language learning assistant for a learner at level ${level}/5. Be encouraging and recognize that there are often multiple correct ways to translate the same sentence. Focus on meaning and naturalness rather than exact word-for-word matches. Use the specified format for corrections.${level <= 2 ? ` Provide brief clarifications in ${nativeLanguage} along with ${targetLanguage}.` : ''}`,
      });

      if (response?.message?.content) {
        const result = response.message.content.trim();
        if (result === "CORRECT") {
          setEvaluationResult({ isCorrect: true, correctedText: null });
          setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
        } else {
          setEvaluationResult({ isCorrect: false, correctedText: result });
          setScore(prev => ({ total: prev.total + 1 }));
        }
      } else {
        throw new Error('Failed to evaluate translation');
      }
    } catch (err) {
      console.error('[SentencePractice] Error evaluating translation:', err);
      setError(err?.message || 'Failed to evaluate translation');
    } finally {
      setIsEvaluating(false);
    }
  }, [userTranslation, currentSentence, nativeLanguage, targetLanguage, selectedProfile]);

  const handleNext = useCallback(() => {
    setEvaluationResult(null);
    setUserTranslation('');
    setActiveHintIndex(null);
    setActiveHintText('');
    setHintMessage('');
    setClickedHints([]);
    setShowAddClickedWords(false);
    generateSentence();
  }, [generateSentence]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (userTranslation.trim() && !isEvaluating) {
      evaluateTranslation();
    }
  }, [userTranslation, isEvaluating, evaluateTranslation]);

  // Generate first sentence on mount
  useEffect(() => {
    generateSentence();
  }, [generateSentence]);

  const handleWordClick = useCallback(async (word, event, surroundingText = '', tokenIndex = -1) => {
    if (!event) return;
    if (!hintMode) return; // No interactions unless in hint mode
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popupWidth = 380;
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    const xPos = fitsOnRight ? rect.right + 5 : rect.left - popupWidth - 5;
    // When hint mode is on, we never show the dictionary popup

    setLoadingDefinition(true);
    try {
      // Toggle behavior: clicking same word again removes hint
      if (activeHintIndex === tokenIndex) {
        setActiveHintIndex(null);
        setActiveHintText('');
        return;
      }

      // Contextual translation using full sentence and marked word
      const sentenceWithMarkedWord = (surroundingText || '').replace(new RegExp(`\\b(${word})\\b`, 'i'), '~$1~');
      const prompt = `Translate ONLY the ~marked~ word from the following ${nativeLanguage} sentence into ${targetLanguage}. Provide the best translation for THIS CONTEXT.\n\nSentence: ${sentenceWithMarkedWord}\nTarget word (marked with tildes): ${word}\nReturn only the ${targetLanguage} word or two-word phrase, no punctuation or quotes.`;
      const resp = await aiService.sendChat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'Return only the translation text.'
      });
      const translationOnly = (resp?.message?.content || '').trim().replace(/^"|"$/g, '');
      setActiveHintIndex(Number.isInteger(tokenIndex) ? tokenIndex : null);
      setActiveHintText(translationOnly);
      setHintMessage('');
      // Track clicked translation for later addition
      if (Number.isInteger(tokenIndex) && tokenIndex >= 0 && translationOnly) {
        setClickedHints((prev) => {
          const withoutDup = prev.filter((p) => p.index !== tokenIndex && p.word?.toLowerCase() !== word.toLowerCase());
          return [...withoutDup, { index: tokenIndex, word, translation: translationOnly }];
        });
      }
    } catch (err) {
      // On error, clear hint
      setActiveHintIndex(null);
      setActiveHintText('');
    } finally {
      setLoadingDefinition(false);
    }
  }, [nativeLanguage, targetLanguage, hintMode, activeHintIndex]);

  const renderClickableTokens = useCallback((text, keyPrefix, clickable = false) => {
    const tokens = tokenizeText(text || '');
    return tokens.map((token, index) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      const tokenKey = `${keyPrefix}-${index}`;
      const wasClicked = clickedHints.some((c) => c.index === index);
      return (
        <span
          key={tokenKey}
          onClick={isWord && clickable ? (e) => handleWordClick(token, e, text, index) : undefined}
          className={isWord && clickable ? 'sp-clickable-word' : ''}
          style={isWord && clickable ? { position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', color: wasClicked ? '#7dd3fc' : undefined } : undefined}
        >
          {isWord && clickable && activeHintIndex === index && activeHintText ? (
            <span
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 1,
                fontSize: '1em',
                fontStyle: 'italic',
                lineHeight: 1,
                color: '#93c5fd',
                background: 'transparent',
                pointerEvents: 'none',
                zIndex: 1,
                whiteSpace: 'nowrap'
              }}
            >
              {activeHintText}
            </span>
          ) : null}
          {token}
        </span>
      );
    });
  }, [handleWordClick, activeHintIndex, activeHintText, clickedHints]);

  const openExplainPopup = async (event, oldWord, newWord) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = { x: rect.left, y: rect.bottom };
    setExplainPopup((prev) => ({ ...prev, visible: true, position: pos, oldWord, newWord, loading: true, response: '' }));
    try {
      const prompt = `Explain briefly why "${oldWord}" is incorrect and "${newWord}" is correct in ${targetLanguage}.`;
      const response = await aiService.sendChat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a helpful language tutor. Explain grammar or word choice differences clearly and briefly.',
      });
      const content = response?.message?.content || '';
      setExplainPopup((prev) => ({ ...prev, loading: false, response: content }));
    } catch (err) {
      setExplainPopup((prev) => ({ ...prev, loading: false, response: 'Failed to load explanation.' }));
    }
  };

  const handleExplainFollowUp = async (e) => {
    e.preventDefault();
    const q = explainPopup.input.trim();
    if (!q) return;
    setExplainPopup((prev) => ({ ...prev, loading: true }));
    try {
      const baseContext = `Original (${nativeLanguage}): ${currentSentence}\nYour translation (${targetLanguage}): ${userTranslation}\nCorrection: ${explainPopup.oldWord} -> ${explainPopup.newWord}`;
      const response = await aiService.sendChat({
        messages: [
          { role: 'system', content: baseContext },
          { role: 'user', content: q },
        ],
        systemPrompt: 'Continue explaining concisely with examples when helpful.',
      });
      const content = response?.message?.content || '';
      setExplainPopup((prev) => ({ ...prev, loading: false, response: content, input: '' }));
    } catch (err) {
      setExplainPopup((prev) => ({ ...prev, loading: false, response: 'Failed to get response.' }));
    }
  };

  const renderCorrectedText = (text) => {
    if (!text) return null;

    // Parse the --oldWord[newWord] format
    const parts = text.split(/(--[^[]+\[[^\]]+\])/);
    
    return parts.map((part, index) => {
      const match = part.match(/^--([^[]+)\[([^\]]+)\]$/);
      if (match) {
        const [, oldWord, newWord] = match;
        return (
          <span key={index} className="correction-pair">
            <span className="correction-new">{newWord}</span>
            <span className="correction-old">{oldWord}</span>
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helpers to render full corrected sentence and original with strike-through
  const extractCorrectionPairs = (text) => {
    if (!text || typeof text !== 'string') return [];
    const regex = /--([^\[]+)\[([^\]]+)\]/g;
    const pairs = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      const oldWord = (m[1] || '').trim();
      const newWord = (m[2] || '').trim();
      if (oldWord && newWord) pairs.push({ oldWord, newWord });
    }
    return pairs;
  };

  const buildCorrectedSentence = (original, pairs) => {
    if (!original || !pairs || pairs.length === 0) return original || '';
    const replacementMap = new Map(
      pairs
        .filter(p => p.oldWord && p.newWord)
        .map(({ oldWord, newWord }) => [String(oldWord).toLowerCase(), String(newWord)])
    );
    const tokens = tokenizeText(original || '');
    const replaced = tokens.map((token) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      if (!isWord) return token;
      const lower = token.toLowerCase();
      if (!replacementMap.has(lower)) return token;
      const newWord = replacementMap.get(lower);
      const isCapitalized = /^[A-ZÁÉÍÓÚÑÜ]/.test(token);
      return isCapitalized && newWord
        ? newWord.charAt(0).toUpperCase() + newWord.slice(1)
        : newWord;
    });
    return replaced.join('');
  };

  const renderOriginalWithStrikes = (original, pairs) => {
    if (!original) return null;
    const tokens = tokenizeText(original || '');
    const toStrike = new Set((pairs || []).map(p => (p.oldWord || '').toLowerCase()));
    return tokens.map((token, index) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      const shouldStrike = isWord && toStrike.has(token.toLowerCase());
      return (
        <span key={`strike-${index}`} style={shouldStrike ? { textDecoration: 'line-through', color: '#ef4444' } : undefined}>
          {token}
        </span>
      );
    });
  };

  return (
    <div className="sentence-practice-container">
      <div className="sentence-practice-header">
        <button 
          className="sentence-practice-back"
          onClick={onBack}
          aria-label="Back to AI mode selector"
        >
          ← {ui?.back || "Back"}
        </button>
        <div className="sentence-practice-title">
          <h2>{ui?.aiSentencePractice || "Sentence Practice"}</h2>
          <div className="sentence-practice-score">
            {ui?.score || "Score"}: {score.correct}/{score.total}
          </div>
        </div>
      </div>

      <div className="sentence-practice-content">
        <div className="sentence-practice-controls">
          <label className="toggle-accents">
            <input type="checkbox" checked={ignoreAccents} onChange={(e)=> setIgnoreAccents(e.target.checked)} />
            <span>{ui?.ignoreAccents || 'Ignore accents when checking'}</span>
          </label>
          <button
            className="hint-button"
            onClick={() => {
              setHintMode((v) => !v);
              setHintMessage(ui?.hintClickInstruction || 'Click any word in the sentence to see a brief translation.');
            }}
          >
            {hintMode ? (ui?.hintsOn || 'Hints: ON') : (ui?.needHint || 'I need a hint!')}
          </button>
          {hintMode && (() => { const code = getLanguageCodeForProfile(selectedProfile); return getConjugationBundle(code); })() && (
            <button
              className="conjugation-help-button"
              onClick={async () => {
                try {
                  const code = getLanguageCodeForProfile(selectedProfile);
                  const bundle = getConjugationBundle(code);
                  const keys = Object.keys(bundle?.tenses || {});
                  const numbered = keys.map((k, i) => `${i + 1}. ${k} - ${bundle.tenses[k].label}`).join('\n');
                  const detectPrompt = `Choose the best conjugation tense(s) for translating this ${nativeLanguage} sentence into ${targetLanguage}. Respond ONLY with the number(s) (comma-separated if multiple).\n\nSentence: ${currentSentence}\nOptions:\n${numbered}`;
                  const resp = await aiService.sendChat({
                    messages: [{ role: 'user', content: detectPrompt }],
                    systemPrompt: 'Return only numbers referencing the best matching options, comma-separated if multiple.'
                  });
                  const raw = (resp?.message?.content || '').trim();
                  const nums = raw.split(/[^\d]+/).map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= keys.length);
                  const chosen = nums.length ? Array.from(new Set(nums)).map(n => keys[n - 1]) : [keys[0]];
                  setSelectedTenseKeys(chosen);
                } catch (_) {
                  setSelectedTenseKeys([]);
                }
                setShowConjugationHelp(true);
              }}
            >
              {ui?.conjugationHelp || 'Conjugation help'}
            </button>
          )}
        </div>
        {hintMode && hintMessage && (
          <div className="hint-banner">
            {hintMessage}
          </div>
        )}
        {isLoading ? (
          <div className="sentence-practice-loading">
            <div className="loading-spinner"></div>
            <p>{ui?.generatingSentence || "Generating sentence..."}</p>
          </div>
        ) : currentSentence ? (
          <>
            <div className="sentence-practice-prompt">
              <h3>{ui?.translateThis || "Translate this sentence"}:</h3>
              <div className="sentence-practice-original">
                {renderClickableTokens(currentSentence, 'orig', hintMode)}
              </div>
              {targetWord && (
                <div className="target-word-hint">
                  Use the word <strong>{targetWord}</strong> in your translation.
                </div>
              )}
              <p className="sentence-practice-instructions">
                {ui?.translateTo || "Translate to"}: <strong>{targetLanguage}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="sentence-practice-form">
              <textarea
                value={userTranslation}
                onChange={(e) => setUserTranslation(e.target.value)}
                placeholder={ui?.enterTranslation || "Enter your translation..."}
                rows={3}
                disabled={isEvaluating}
                className="sentence-practice-input"
              />
              <button
                type="submit"
                disabled={!userTranslation.trim() || isEvaluating}
                className="sentence-practice-submit"
              >
                {isEvaluating ? (ui?.evaluating || "Evaluating...") : (ui?.checkTranslation || "Check Translation")}
              </button>
            </form>

            {evaluationResult && (
              <div className="sentence-practice-result">
                {evaluationResult.isCorrect ? (
                  <div className="result-correct">
                    <div className="result-icon">✓</div>
                    <div className="result-text">
                      <h4>{ui?.correct || "Correct!"}</h4>
                      <p>{ui?.wellDone || "Well done! Your translation is correct."}</p>
                    </div>
                  </div>
                ) : (
                  <div className="result-incorrect">
                    <div className="result-icon">✗</div>
                    <div className="result-text">
                      <h4>{ui?.needsCorrection || "Needs Correction"}</h4>
                      <div className="correction-display">
                        {(() => {
                          const pairs = extractCorrectionPairs(evaluationResult.correctedText || '');
                          const correctedFull = buildCorrectedSentence(userTranslation, pairs);
                          return (
                            <>
                              <div className="corrected-version">
                                <div className="correction-label">Corrected sentence:</div>
                                <div className="correction-text">
                                  {renderClickableTokens(correctedFull, 'corr-full', false)}
                                </div>
                              </div>
                              <div className="your-translation">
                                <div className="yt-label">Your sentence (errors struck):</div>
                                <div className="yt-content">
                                  {renderOriginalWithStrikes(userTranslation, pairs)}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleNext}
                  className="sentence-practice-next"
                >
                  {ui?.nextSentence || "Next Sentence"}
                </button>
                {!evaluationResult.isCorrect && clickedHints.length > 0 && (
                  <div className="add-clicked-words-panel" style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Add unknown words to dictionary?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {clickedHints.map((item, idx) => (
                        <span key={`cw-${item.index}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#0b1728', border: '1px solid #1f2a37', borderRadius: 6 }}>
                          <span style={{ color: '#7dd3fc', fontStyle: 'italic' }}>{item.translation}</span>
                          <button onClick={() => setClickedHints(prev => prev.filter(p => p.index !== item.index))} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>×</button>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        // Add each translation headword to dictionary
                        for (const item of clickedHints) {
                          const head = (item.translation || '').split(/[,;\s]+/)[0];
                          if (head) {
                            try { await onAddWord?.(head.toLowerCase()); } catch (e) { console.warn('add word failed', e); }
                          }
                        }
                        setClickedHints([]);
                        setShowAddClickedWords(false);
                      }}
                      style={{ marginTop: 10, padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Add all
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}

        {error && (
          <div className="sentence-practice-error">
            {error}
          </div>
        )}
      </div>
      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={false}
          onAddToDictionary={() => {}}
          onRemoveFromDictionary={() => {}}
          loading={loadingDefinition}
          nativeLanguage={nativeLanguage}
          onClose={() => setPopupInfo((prev) => ({ ...prev, visible: false }))}
        />
      )}

      {showConjugationHelp && (() => {
        const code = getLanguageCodeForProfile(selectedProfile);
        const bundle = code ? getConjugationBundle(code) : null;
        if (!bundle) return null;
        return (
        <div className="conjugation-modal" onClick={() => setShowConjugationHelp(false)}>
          <div className="conjugation-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close-btn" onClick={() => setShowConjugationHelp(false)}>×</button>
            {(() => {
              const tenses = bundle.tenses;
              const persons = bundle.persons;
              const keysToShow = (selectedTenseKeys && selectedTenseKeys.length) ? selectedTenseKeys.filter(k => tenses[k]) : [Object.keys(tenses)[0]];
              return (
                <div>
                  {keysToShow.map((tenseKey) => {
                    const table = tenses[tenseKey];
                    return (
                      <div key={tenseKey} style={{ marginBottom: 16 }}>
                        <h3>{table.label}</h3>
                        <p style={{ marginTop: 4 }}>{table.description}</p>
                        {persons ? (
                          <div className="conjugation-table">
                            <div className="conj-header">Person</div>
                            {table.ar && <div className="conj-header">-ar</div>}
                            {table.er && <div className="conj-header">-er</div>}
                            {table.ir && <div className="conj-header">-ir</div>}
                            {table.regular && <div className="conj-header" style={{ gridColumn: 'span 3' }}>Regular</div>}
                            {table.common && <div className="conj-header" style={{ gridColumn: 'span 3' }}>Common</div>}
                            {persons.map((person, idx) => (
                              <React.Fragment key={`${tenseKey}-${idx}`}>
                                <div className="conj-cell person">{person}</div>
                                {table.ar && <div className="conj-cell">{table.ar[idx]}</div>}
                                {table.er && <div className="conj-cell">{table.er[idx]}</div>}
                                {table.ir && <div className="conj-cell">{table.ir[idx]}</div>}
                                {table.regular && <div className="conj-cell" style={{ gridColumn: 'span 3' }}>{table.regular[idx]}</div>}
                                {table.common && <div className="conj-cell" style={{ gridColumn: 'span 3' }}>{table.common[idx]}</div>}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontWeight: 600 }}>{table.label}</div>
                            <div style={{ opacity: 0.8 }}>{table.description}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
        );
      })()}

      {explainPopup.visible && (
        <div className="explain-popup" style={{ 
          top: explainPopup.position.y > 0 ? explainPopup.position.y + 6 : '50%', 
          left: explainPopup.position.x > 0 ? explainPopup.position.x : '50%',
          transform: explainPopup.position.x > 0 ? 'none' : 'translate(-50%, -50%)'
        }}>
          <button className="popup-close-btn" onClick={() => setExplainPopup((p)=> ({ ...p, visible: false }))}>×</button>
          <div className="explain-header">
            <span className="explain-title">
              {explainPopup.oldWord && explainPopup.newWord ? 
                `Why ${explainPopup.oldWord} → ${explainPopup.newWord}?` : 
                'Corrections'
              }
            </span>
          </div>
          <div className="explain-body">
            {explainPopup.loading ? (
              <div className="dict-loading">
                <div className="dict-loading-spinner"></div>
                <div className="dict-loading-text">Loading…</div>
              </div>
            ) : (
              <div className="explain-text">
                {explainPopup.oldWord && explainPopup.newWord ? 
                  explainPopup.response : 
                  <div className="corrections-display">{explainPopup.response}</div>
                }
              </div>
            )}
          </div>
          {explainPopup.oldWord && explainPopup.newWord && (
            <form onSubmit={handleExplainFollowUp} className="explain-form">
              <input type="text" value={explainPopup.input} onChange={(e)=> setExplainPopup((p)=> ({ ...p, input: e.target.value }))} placeholder="Ask a follow-up…" disabled={explainPopup.loading} />
              <button type="submit" disabled={explainPopup.loading || !explainPopup.input.trim()}>Ask</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

SentencePractice.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  selectedWords: PropTypes.array,
  onBack: PropTypes.func.isRequired,
};

export default SentencePractice;
