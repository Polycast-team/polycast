import { useMemo, useCallback, useState } from 'react';

/**
 * Shared hook for flashcard calendar functionality
 * Calculates upcoming due dates for the next 8 days
 */
export function useFlashcardCalendar(
  dueCards,
  wordDefinitions,
  availableCards,
  selectedProfile,
  processedCards,
  calendarUpdateTrigger
) {
  // Local version counter to reflect manual reorders immediately
  const [orderVersion, setOrderVersion] = useState(0);
  // Build the unseen senses queue sorted by frequency (desc)
  const queue = useMemo(() => {
    if (!wordDefinitions) return [];
    const items = [];
    Object.entries(wordDefinitions).forEach(([key, entry]) => {
      if (!entry || !entry.inFlashcards || !entry.wordSenseId) return;
      // Treat "new" as unseen
      const isNew = entry?.srsData?.isNew === true || (!entry?.srsData || ((entry?.srsData?.correctCount || 0) + (entry?.srsData?.incorrectCount || 0)) === 0);
      if (!isNew) return;
      items.push({
        wordSenseId: entry.wordSenseId,
        word: entry.word,
        translation: entry.translation || entry.disambiguatedDefinition?.translation || '',
        definition: entry.definition || entry.disambiguatedDefinition?.definition || '',
        example: entry.contextSentence || entry.example || '',
        frequency: Number(entry.frequency || 5)
      });
    });
    // Sort by frequency desc, stable
    items.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));

    // Apply saved order override per profile
    try {
      const saved = JSON.parse(localStorage.getItem(`pc_calendarQueueOrder_${selectedProfile}`) || '[]');
      if (Array.isArray(saved) && saved.length) {
        const map = new Map(items.map((it) => [it.wordSenseId, it]));
        const ordered = [];
        saved.forEach((id) => { if (map.has(id)) { ordered.push(map.get(id)); map.delete(id); } });
        // Append any new items (keep frequency order among the remaining)
        const rest = Array.from(map.values());
        ordered.push(...rest);
        return ordered;
      }
    } catch {}
    return items;
  }, [wordDefinitions, selectedProfile, calendarUpdateTrigger, orderVersion]);

  // Reorder and persist
  const reorderQueue = useCallback((newOrderIds) => {
    try {
      localStorage.setItem(`pc_calendarQueueOrder_${selectedProfile}`, JSON.stringify(newOrderIds));
    } catch {}
    // Trigger a re-computation immediately
    setOrderVersion((v) => v + 1);
  }, [selectedProfile]);

  return { queue, reorderQueue };
}