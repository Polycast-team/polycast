import { useState, useCallback, useEffect } from 'react';
import {
  getLanguageForProfile,
  getNativeLanguageForProfile,
} from '../utils/profileLanguageMapping.js';
import apiService from '../services/apiService.js';
import authClient from '../services/authClient.js';
import { createFlashcardEntry } from '../components/FixedCardDefinitions';
import { extractSentenceWithWord } from '../utils/wordClickUtils';

/**
 * Hook for managing dictionary words and flashcard entries
 * Handles add/remove operations and server synchronization
 */
export function useWordManagement(selectedProfile, fullTranscript, showError) {
  const [selectedWords, setSelectedWords] = useState([]);
  const [wordDefinitions, setWordDefinitions] = useState({});
  const [isAddingWordBusy, setIsAddingWordBusy] = useState(false);

  // Load dictionary from server after login and on refresh events
  const reloadServerDictionary = useCallback(async () => {
    try {
      const rows = await apiService.fetchJson(`${apiService.baseUrl}/api/dictionary`);
      const map = {};
      (rows || []).forEach(r => {
        const u = r.gemini_unified_json || {};
        const isNewFromDb = !r.due_at;
        map[r.sense_key] = {
          dbId: r.id,
          word: r.word,
          wordSenseId: r.sense_key,
          translation: u.translation || '',
          definition: u.definition || '',
          frequency: u.frequency || 5,
          example: u.exampleForDictionary || u.example || '',
          exampleSentencesGenerated: u.exampleSentencesGenerated || '',
          exampleForDictionary: u.exampleForDictionary || '',
          contextualExplanation: u.definition || '',
          inFlashcards: true,
          srsData: {
            status: isNewFromDb ? 'new' : 'review',
            isNew: isNewFromDb,
            gotWrongThisSession: false,
            SRS_interval: r.study_interval_level || 1,
            dueDate: r.due_at || null,
            nextReviewDate: r.due_at || null,
          }
        };
      });
      setWordDefinitions(map);
      setSelectedWords(Array.from(new Set((rows || []).map(r => r.word))));
    } catch (e) {
      console.error('Failed to load server dictionary:', e);
    }
  }, []);

  // Load on mount if authenticated
  useEffect(() => {
    const token = authClient.getToken && authClient.getToken();
    if (!token) return;
    reloadServerDictionary();
  }, [reloadServerDictionary]);

  // Listen for refresh events
  useEffect(() => {
    const handler = () => { reloadServerDictionary(); };
    window.addEventListener('dictionary:refresh', handler);
    return () => window.removeEventListener('dictionary:refresh', handler);
  }, [reloadServerDictionary]);

  // One-time cleanup: remove any flashcard entries missing exampleSentencesGenerated
  useEffect(() => {
    try {
      const entries = wordDefinitions || {};
      const hasBroken = Object.values(entries).some(e => e && e.inFlashcards && !e.exampleSentencesGenerated);
      if (!hasBroken) return;
      const cleaned = {};
      Object.entries(entries).forEach(([key, entry]) => {
        if (entry && (!entry.inFlashcards || entry.exampleSentencesGenerated)) {
          cleaned[key] = entry;
        }
      });
      setWordDefinitions(cleaned);
      const uniqueWords = Array.from(new Set(Object.values(cleaned).filter(e => e && e.inFlashcards).map(e => e.word)));
      setSelectedWords(uniqueWords);
    } catch {}
  }, []);

  // Add a word to dictionary
  const handleAddWord = useCallback(async (word) => {
    const wordLower = (word || '').toLowerCase();
    const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
    const targetLanguage = getLanguageForProfile(selectedProfile);

    // Extract sentence and mark the word with tildes
    let sentence = extractSentenceWithWord(fullTranscript || '', wordLower);
    if (!sentence || !sentence.trim()) {
      console.debug('[handleAddWord] No transcript context found; falling back to word only.');
      sentence = wordLower;
    }

    // Mark the first occurrence
    const wordRegex = new RegExp(`\\b(${wordLower})\\b`, 'i');
    let sentenceWithMarkedWord = sentence.replace(wordRegex, '~$1~');

    if (!sentenceWithMarkedWord.includes('~')) {
      sentenceWithMarkedWord = `~${wordLower}~`;
    }

    console.log(`🎯 [handleAddWord] Using UNIFIED API for word: "${wordLower}"`);

    const requestUrl = apiService.getUnifiedWordDataUrl(
      wordLower,
      sentenceWithMarkedWord,
      nativeLanguage,
      targetLanguage
    );

    try {
      setIsAddingWordBusy(true);

      const unifiedData = await apiService.fetchJson(requestUrl);
      console.log(`🌐 [handleAddWord] Unified API Response:`, unifiedData);

      // Count existing senses for numbering
      const existingSenses = Object.values(wordDefinitions).filter(
        (e) => e && e.inFlashcards && e.word === wordLower
      );
      const definitionNumber = existingSenses.length + 1;
      const wordSenseId = `${wordLower}-${Date.now()}`;

      // Create flashcard entry
      const entry = createFlashcardEntry(
        wordLower,
        wordSenseId,
        unifiedData.exampleForDictionary || unifiedData.example || '',
        unifiedData.definition || wordLower,
        '',
        definitionNumber
      );

      // Enrich with unified data
      const enriched = {
        ...entry,
        translation: unifiedData.translation || '',
        example: unifiedData.exampleForDictionary || unifiedData.example || '',
        contextSentence: unifiedData.exampleForDictionary || unifiedData.example || '',
        frequency: unifiedData.frequency || 5,
        exampleSentencesGenerated: unifiedData.exampleSentencesGenerated || ''
      };

      // Persist to server
      const saved = await apiService.postJson(`${apiService.baseUrl}/api/dictionary`, {
        word: wordLower,
        senseKey: wordSenseId,
        geminiUnifiedText: unifiedData.rawText || '',
        geminiUnifiedJson: unifiedData || null,
        studyIntervalLevel: 1,
        dueAt: null,
      });

      setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: { ...enriched, dbId: saved?.id } }));
      setSelectedWords((prev) => (prev.includes(wordLower) ? prev : [...prev, wordLower]));

      console.log(`✅ [handleAddWord] Successfully added word: ${wordLower}`);
      return enriched;
    } catch (err) {
      console.error('Unified API failed:', err);
      showError && showError(`Failed to add word: ${err.message}`);
      return null;
    } finally {
      setIsAddingWordBusy(false);
    }
  }, [wordDefinitions, fullTranscript, selectedProfile, showError]);

  // Add multiple senses at once
  const handleAddWordSenses = useCallback((word, senses) => {
    const wordLower = (word || '').toLowerCase();
    const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
    const targetLanguage = getLanguageForProfile(selectedProfile);

    const baseCount = Object.values(wordDefinitions).filter(
      (e) => e && e.inFlashcards && e.word === wordLower
    ).length;

    setIsAddingWordBusy(true);
    const promises = senses.map(async (sense, idx) => {
      const definitionNumber = baseCount + idx + 1;
      const wordSenseId = `${wordLower}-${Date.now()}-${idx}`;
      const sentenceWithMarkedWord = sense?.example || `~${wordLower}~`;

      try {
        const url = apiService.getUnifiedWordDataUrl(
          wordLower,
          sentenceWithMarkedWord,
          nativeLanguage,
          targetLanguage
        );

        const unifiedData = await apiService.fetchJson(url);

        const entry = createFlashcardEntry(
          wordLower,
          wordSenseId,
          sentenceWithMarkedWord,
          unifiedData.definition || sense?.definition || wordLower,
          '',
          definitionNumber
        );

        // Persist to server
        let saved = null;
        try {
          saved = await apiService.postJson(`${apiService.baseUrl}/api/dictionary`, {
            word: wordLower,
            senseKey: wordSenseId,
            geminiUnifiedText: unifiedData.rawText || '',
            geminiUnifiedJson: unifiedData || null,
            studyIntervalLevel: 1,
            dueAt: null,
          });
        } catch (e) {
          console.warn('Failed to persist wordsense:', e);
        }

        const enriched = {
          ...entry,
          translation: unifiedData.translation || sense?.translation || '',
          example: unifiedData.exampleForDictionary || sense?.example || '',
          contextSentence: sentenceWithMarkedWord,
          frequency: unifiedData.frequency || Math.max(1, Math.min(10, Number(sense?.frequency) || 5)),
          exampleSentencesGenerated: unifiedData.exampleSentencesGenerated || '',
          dbId: saved?.id
        };

        setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: enriched }));
      } catch (err) {
        console.error('Failed to get unified word data for sense:', err);
        // Fallback to basic entry
        const entry = createFlashcardEntry(
          wordLower,
          wordSenseId,
          sense?.example || '',
          sense?.definition || wordLower,
          '',
          definitionNumber
        );

        const enriched = {
          ...entry,
          translation: sense?.translation || '',
          example: sense?.example || '',
          contextSentence: sense?.example || '',
          frequency: Math.max(1, Math.min(10, Number(sense?.frequency) || 5)),
          exampleSentencesGenerated: ''
        };

        setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: enriched }));
      }
    });

    setSelectedWords((prev) => (prev.includes(wordLower) ? prev : [...prev, wordLower]));
    Promise.allSettled(promises).finally(() => setIsAddingWordBusy(false));
  }, [wordDefinitions, selectedProfile]);

  // Remove a word sense
  const handleRemoveWord = useCallback(async (wordSenseId, word) => {
    console.log(`Removing word from dictionary: ${word} (${wordSenseId})`);
    try {
      const wordEntry = wordDefinitions[wordSenseId];
      if (!wordEntry) {
        console.warn(`Could not find entry for sense ID: ${wordSenseId}`);
        return;
      }

      const wordLower = wordEntry.word.toLowerCase();

      // Persist delete if entry exists in DB
      if (wordEntry.dbId) {
        try {
          await apiService.fetchJson(`${apiService.baseUrl}/api/dictionary/${wordEntry.dbId}`, { method: 'DELETE' });
        } catch (e) { console.warn('Server delete failed:', e); }
      }

      // Check if this is the last sense for this word
      const otherSensesForSameWord = Object.entries(wordDefinitions)
        .filter(([key, entry]) =>
          entry && entry.word && entry.word.toLowerCase() === wordLower &&
          entry.wordSenseId && entry.wordSenseId !== wordSenseId &&
          entry.inFlashcards);

      const isLastSenseOfWord = otherSensesForSameWord.length === 0;

      // Remove from wordDefinitions
      setWordDefinitions(prev => {
        const updated = { ...prev };
        delete updated[wordSenseId];
        return updated;
      });

      // Only remove from selectedWords if last sense
      if (isLastSenseOfWord) {
        setSelectedWords(prev => prev.filter(w => w.toLowerCase() !== wordLower));
      }
    } catch (error) {
      console.error(`Error removing word from dictionary: ${error}`);
      showError && showError(`Failed to delete "${word}" from dictionary. Please try again.`);
    }
  }, [wordDefinitions, showError]);

  return {
    selectedWords,
    setSelectedWords,
    wordDefinitions,
    setWordDefinitions,
    isAddingWordBusy,
    handleAddWord,
    handleAddWordSenses,
    handleRemoveWord,
    reloadServerDictionary
  };
}
