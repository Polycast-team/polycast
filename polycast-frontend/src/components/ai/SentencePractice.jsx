import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile, getProficiencyForProfile } from '../../utils/profileLanguageMapping';
import apiService from '../../services/apiService';
import aiService from '../../services/aiService';
import tokenizeText from '../../utils/tokenizeText';
import WordDefinitionPopup from '../WordDefinitionPopup';
import { getConjugationTable, SPANISH_PERSON_LABELS } from '../../utils/spanishConjugations';
import './SentencePractice.css';

function SentencePractice({
  selectedProfile,
  selectedWords,
  onBack,
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
  const [detectedTense, setDetectedTense] = useState(null);

  const generateSentence = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setEvaluationResult(null);
    setUserTranslation('');
    setTargetWord(null);

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
      const sentenceWithMarkedWord = (surroundingText || '').replace(new RegExp(`\\b(${word})\\b`, 'i'), '~$1~');
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
      if (hintMode) {
        setHintMessage(`${word}: ${unifiedData?.translation || word}`);
      }
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
      if (hintMode) {
        setHintMessage(`${word}`);
      }
    } finally {
      setLoadingDefinition(false);
    }
  }, [nativeLanguage, targetLanguage]);

  const renderClickableTokens = useCallback((text, keyPrefix) => {
    const tokens = tokenizeText(text || '');
    return tokens.map((token, index) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      const tokenKey = `${keyPrefix}-${index}`;
      return (
        <span
          key={tokenKey}
          onClick={isWord ? (e) => handleWordClick(token, e, text) : undefined}
          className={isWord ? 'sp-clickable-word' : ''}
        >
          {token}
        </span>
      );
    });
  }, [handleWordClick]);

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
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    let output = original;
    pairs.forEach(({ oldWord, newWord }) => {
      if (!oldWord) return;
      const pattern = new RegExp(`\\b${escapeRegExp(oldWord)}\\b`, 'gi');
      output = output.replace(pattern, (match) => {
        // Preserve capitalization style of the original token
        const isCapitalized = /^[A-ZÁÉÍÓÚÑÜ]/.test(match);
        if (isCapitalized && newWord) {
          return newWord.charAt(0).toUpperCase() + newWord.slice(1);
        }
        return newWord;
      });
    });
    return output;
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
            <span>Ignore accents when checking</span>
          </label>
          <button
            className="hint-button"
            onClick={() => {
              setHintMode((v) => !v);
              setHintMessage('Click any word in the sentence to see a brief translation.');
            }}
          >
            {hintMode ? 'Hints: ON' : 'I need a hint!'}
          </button>
          {hintMode && (
            <button
              className="conjugation-help-button"
              onClick={async () => {
                try {
                  // Lightweight tense detection prompt
                  const detectPrompt = `Given this ${nativeLanguage} sentence: "${currentSentence}" and the target language ${targetLanguage}, identify which Spanish tense is primarily required for an accurate translation. Reply with one key: present | preterite | imperfect | future | conditional | present_subjunctive | imperfect_subjunctive | present_perfect. Reply ONLY the key.`;
                  const resp = await aiService.sendChat({
                    messages: [{ role: 'user', content: detectPrompt }],
                    systemPrompt: 'Reply only with the key name from the provided list.'
                  });
                  const key = (resp?.message?.content || '').trim().toLowerCase();
                  setDetectedTense(key);
                } catch (_) {
                  setDetectedTense('present');
                }
                setShowConjugationHelp(true);
              }}
            >
              Conjugation help
            </button>
          )}
        </div>
        {hintMode && hintMessage && (
          <div className="hint-banner">
            {hintMessage}
          </div>
        )}
        </div>
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
                {renderClickableTokens(currentSentence, 'orig')}
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
                                  {renderClickableTokens(correctedFull, 'corr-full')}
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

      {showConjugationHelp && (
        <div className="conjugation-modal">
          <div className="conjugation-modal-content">
            <button className="popup-close-btn" onClick={() => setShowConjugationHelp(false)}>×</button>
            {(() => {
              const table = getConjugationTable(detectedTense || 'present');
              if (!table) return <div>No table found.</div>;
              return (
                <div>
                  <h3>{table.label}</h3>
                  <p style={{ marginTop: 4 }}>{table.description}</p>
                  <div className="conjugation-table">
                    <div className="conj-header">Person</div>
                    <div className="conj-header">-ar</div>
                    <div className="conj-header">-er</div>
                    <div className="conj-header">-ir</div>
                    {SPANISH_PERSON_LABELS.map((person, idx) => (
                      <React.Fragment key={`row-${idx}`}>
                        <div className="conj-cell person">{person}</div>
                        <div className="conj-cell">{table.ar[idx]}</div>
                        <div className="conj-cell">{table.er[idx]}</div>
                        <div className="conj-cell">{table.ir[idx]}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

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
