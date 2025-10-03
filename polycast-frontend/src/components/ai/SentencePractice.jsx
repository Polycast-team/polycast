import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../../utils/profileLanguageMapping';
import aiService from '../../services/aiService';
import './SentencePractice.css';

function SentencePractice({
  selectedProfile,
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

  const generateSentence = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setEvaluationResult(null);
    setUserTranslation('');

    try {
      const prompt = `Generate a simple sentence in ${nativeLanguage} for a language learner to translate into ${targetLanguage}. The sentence should be appropriate for intermediate level and contain common vocabulary. Return only the sentence, no additional text.`;
      
      const response = await aiService.sendChat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: "You are a language learning assistant. Generate simple, clear sentences for translation practice.",
      });

      if (response?.message?.content) {
        setCurrentSentence(response.message.content.trim());
      } else {
        throw new Error('Failed to generate sentence');
      }
    } catch (err) {
      console.error('[SentencePractice] Error generating sentence:', err);
      setError(err?.message || 'Failed to generate sentence');
    } finally {
      setIsLoading(false);
    }
  }, [nativeLanguage, targetLanguage]);

  const evaluateTranslation = useCallback(async () => {
    if (!userTranslation.trim() || !currentSentence) return;

    setIsEvaluating(true);
    setError('');

    try {
      const prompt = `Evaluate this translation:

Original sentence (${nativeLanguage}): "${currentSentence}"
User's translation (${targetLanguage}): "${userTranslation}"

If the translation is correct, respond with: "CORRECT"

If the translation has errors, provide the corrected version using this format:
- For each word that should be replaced, use: --oldWord[newWord]
- Example: "How --is[are] you" means replace "is" with "are"

Return only the evaluation result.`;

      const response = await aiService.sendChat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: "You are a language learning assistant. Evaluate translations and provide corrections using the specified format.",
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
  }, [userTranslation, currentSentence, nativeLanguage, targetLanguage]);

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

  const renderCorrectedText = (text) => {
    if (!text) return null;

    // Parse the --oldWord[newWord] format
    const parts = text.split(/(--[^[]+\[[^\]]+\])/);
    
    return parts.map((part, index) => {
      const match = part.match(/^--([^[]+)\[([^\]]+)\]$/);
      if (match) {
        const [, oldWord, newWord] = match;
        return (
          <span key={index}>
            <span className="correction-old">{oldWord}</span>
            <span className="correction-new">{newWord}</span>
          </span>
        );
      }
      return <span key={index}>{part}</span>;
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
                {currentSentence}
              </div>
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
                        <p>{ui?.correctedVersion || "Here's the corrected version:"}</p>
                      <div className="corrected-translation">
                        {renderCorrectedText(evaluationResult.correctedText)}
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
    </div>
  );
}

SentencePractice.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default SentencePractice;
