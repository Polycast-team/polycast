import { useState, useCallback } from 'react';
import apiService from '../services/apiService.js';

/**
 * Hook for managing transcript and translation state
 * Handles streaming transcript updates and translation messages
 */
export function useTranscriptState(targetLanguages) {
  const [fullTranscript, setFullTranscript] = useState('');
  const [currentPartial, setCurrentPartial] = useState('');
  const [transcriptBlocks, setTranscriptBlocks] = useState([]); // [{speaker:'host'|'student', lines: string[], partial: string}]
  const [translations, setTranslations] = useState({}); // { lang: [{ text: string, isNew: boolean }] }

  // Initialize translations for target languages
  const initializeTranslations = useCallback(() => {
    const initialTranslations = {};
    targetLanguages.forEach(lang => { initialTranslations[lang] = []; });
    setTranslations(initialTranslations);
  }, [targetLanguages]);

  // Handle streaming_transcript message from WebSocket
  const handleTranscriptMessage = useCallback((parsedData) => {
    const speaker = parsedData.speaker || 'host';

    // Maintain grouped transcript blocks by speaker
    setTranscriptBlocks(prev => {
      const blocks = [...prev];
      const last = blocks[blocks.length - 1];
      if (!last || last.speaker !== speaker) {
        blocks.push({ speaker, lines: [], partial: '' });
      }
      const idx = blocks.length - 1;
      if (parsedData.isInterim) {
        blocks[idx].partial = parsedData.text || '';
      } else {
        const text = parsedData.text || '';
        if (text.trim()) blocks[idx].lines.push(text);
        blocks[idx].partial = '';
      }
      return blocks.slice(-100); // cap history
    });

    // Keep legacy concatenated transcript for compatibility
    if (parsedData.isInterim) {
      setCurrentPartial(parsedData.text);
    } else {
      setFullTranscript(prev => {
        const newText = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + parsedData.text;
        return newText;
      });
      setCurrentPartial('');
    }

    return !parsedData.isInterim; // returns true if final (for triggering student translation)
  }, []);

  // Handle translation message (single)
  const handleTranslationMessage = useCallback((parsedData) => {
    setTranslations(prevTranslations => {
      const newTranslations = { ...prevTranslations };
      const lang = parsedData.lang;
      const currentLangSegments = newTranslations[lang] || [];
      const updatedSegments = [
        ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
        { text: parsedData.data, isNew: true }
      ];
      newTranslations[lang] = updatedSegments.slice(-3);
      return newTranslations;
    });
  }, []);

  // Handle translations_batch message
  const handleTranslationsBatch = useCallback((parsedData) => {
    setTranslations(prevTranslations => {
      const newTranslations = { ...prevTranslations };
      for (const lang in parsedData.data) {
        if (parsedData.data.hasOwnProperty(lang)) {
          const currentLangSegments = newTranslations[lang] || [];
          const updatedSegments = [
            ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
            { text: parsedData.data[lang], isNew: true }
          ];
          newTranslations[lang] = updatedSegments.slice(-3);
        }
      }
      return newTranslations;
    });
  }, []);

  // Handle transcript_history message (for newly joined students)
  const handleTranscriptHistory = useCallback((parsedData) => {
    const lines = (parsedData.data || []).map((item) => item && item.text).filter(Boolean);
    if (lines.length > 0) {
      setTranscriptBlocks([{ speaker: 'host', lines, partial: '' }]);
      setFullTranscript(lines.join(' '));
      setCurrentPartial('');
    }
  }, []);

  // Generate student translation (for students generating their own translations)
  const generateStudentTranslation = useCallback(async (englishText, targetLanguage) => {
    try {
      const data = await apiService.fetchJson(apiService.getTranslationUrl(targetLanguage, englishText));
      const translationData = data;
      setTranslations(prevTranslations => {
        const newTranslations = { ...prevTranslations };
        const currentLangSegments = newTranslations[targetLanguage] || [];
        const updatedSegments = [
          ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
          { text: translationData.translation || translationData.data, isNew: true }
        ];
        newTranslations[targetLanguage] = updatedSegments.slice(-3);
        return newTranslations;
      });
    } catch (error) {
      console.error(`Error generating ${targetLanguage} translation:`, error);
    }
  }, []);

  return {
    fullTranscript,
    setFullTranscript,
    currentPartial,
    setCurrentPartial,
    transcriptBlocks,
    setTranscriptBlocks,
    translations,
    setTranslations,
    initializeTranslations,
    handleTranscriptMessage,
    handleTranslationMessage,
    handleTranslationsBatch,
    handleTranscriptHistory,
    generateStudentTranslation
  };
}
