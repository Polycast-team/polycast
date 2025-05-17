import React from 'react';
import PropTypes from 'prop-types';
import './DictionaryTable.css';

const DictionaryTable = ({ wordDefinitions, onRemoveWord }) => {
  // Find all the individual sense entries that should be displayed
  const entriesToDisplay = Object.values(wordDefinitions)
    .filter(entry => entry && entry.inFlashcards && entry.wordSenseId)
    .sort((a, b) => {
      // Sort first by word, then by part of speech
      const wordA = (a.word || '').toLowerCase();
      const wordB = (b.word || '').toLowerCase();
      if (wordA !== wordB) return wordA.localeCompare(wordB);
      
      // If same word, sort by part of speech
      const posA = (a.partOfSpeech || '').toLowerCase();
      const posB = (b.partOfSpeech || '').toLowerCase();
      return posA.localeCompare(posB);
    });

  // Show a message if dictionary is empty
  if (entriesToDisplay.length === 0) {
    return (
      <div className="empty-dictionary-message">
        Your dictionary is empty. Add words from the transcript by clicking on them!
      </div>
    );
  }

  return (
    <div className="dictionary-table-container">
      <table className="dictionary-table">
        <thead>
          <tr>
            <th>Word</th>
            <th>Definition</th>
            <th>Example</th>
            {onRemoveWord && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {entriesToDisplay.map((entry) => {
            // Get word info
            const word = entry.word || '';
            const partOfSpeech = entry.partOfSpeech || 
                               (entry.disambiguatedDefinition?.partOfSpeech) || 
                               '';
            
            // Format word with part of speech if available
            const wordDisplay = partOfSpeech ? 
                              `${word} (${partOfSpeech})` : 
                              word;
            
            // Get definition, prefer Spanish translation when available
            const definition = entry.disambiguatedDefinition?.spanish_equivalent || 
                              entry.disambiguatedDefinition?.translation || 
                              entry.disambiguatedDefinition?.definition || 
                              'N/A';
            
            // Get example sentence - use context or Gemini-generated example
            const example = entry.contextSentence || 
                          entry.disambiguatedDefinition?.example || 
                          'No example available';
                          
            // Get the unique ID for this sense
            const wordSenseId = entry.wordSenseId;

            return (
              <tr key={wordSenseId}>
                {/* Word with part of speech */}
                <td style={{ 
                  padding: 12, 
                  color: '#4ade80', 
                  fontWeight: 'bold' 
                }}>
                  {wordDisplay}
                </td>

                {/* Definition */}
                <td style={{ padding: 12 }}>
                  {definition}
                </td>

                {/* Example sentence */}
                <td style={{ padding: 12, fontStyle: 'italic' }}>
                  {example}
                </td>

                {/* Remove button (optional) */}
                {onRemoveWord && (
                  <td style={{ padding: 12 }}>
                    <button
                        onClick={() => onRemoveWord(wordSenseId)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: 4,
                          color: '#ff6b6b',
                          cursor: 'pointer',
                          fontSize: '1.2em'
                        }}
                        title="Delete this word from your dictionary"
                      >
                        🗑️
                      </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

DictionaryTable.propTypes = {
  wordDefinitions: PropTypes.object.isRequired,
  onRemoveWord: PropTypes.func, // optional – only needed if removal UI is desired
};

export default DictionaryTable;