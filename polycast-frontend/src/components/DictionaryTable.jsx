import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DictionaryTable.css';

const DictionaryTable = ({ wordDefinitions, onRemoveWord }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWords, setExpandedWords] = useState({});
  const [groupedEntries, setGroupedEntries] = useState({});

  // Group entries by word
  useEffect(() => {
    // Group all flashcard entries by their base word
    const grouped = {};
    
    Object.values(wordDefinitions)
      .filter(entry => entry && entry.inFlashcards && entry.wordSenseId && entry.word)
      .forEach(entry => {
        const word = entry.word.toLowerCase();
        
        if (!grouped[word]) {
          grouped[word] = [];
        }
        
        grouped[word].push(entry);
      });
      
    // Sort the entries within each word group
    Object.keys(grouped).forEach(word => {
      grouped[word].sort((a, b) => {
        // Sort by part of speech
        const posA = (a.partOfSpeech || '').toLowerCase();
        const posB = (b.partOfSpeech || '').toLowerCase();
        return posA.localeCompare(posB);
      });
    });
    
    setGroupedEntries(grouped);
  }, [wordDefinitions]);
  
  // Filter words based on search term
  const filteredWords = Object.keys(groupedEntries)
    .filter(word => word.includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  
  // Toggle word expansion
  const toggleExpand = (word) => {
    setExpandedWords(prev => ({
      ...prev,
      [word]: !prev[word]
    }));
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Function to handle removing a definition
  const handleRemoveDefinition = (wordSenseId, word) => {
    if (onRemoveWord) {
      onRemoveWord(wordSenseId, word);
    }
  };

  // Show a message if dictionary is empty
  if (filteredWords.length === 0) {
    return (
      <div className="dictionary-container">
        <div className="dictionary-search">
          <input
            type="text"
            placeholder="Search words..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="dictionary-search-input"
          />
        </div>
        <div className="empty-dictionary-message">
          {searchTerm ? 
            `No words matching "${searchTerm}" found in your dictionary.` : 
            'Your dictionary is empty. Add words from the transcript by clicking on them!'}
        </div>
      </div>
    );
  }

  return (
    <div className="dictionary-container">
      {/* Search bar */}
      <div className="dictionary-search">
        <input
          type="text"
          placeholder="Search words..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="dictionary-search-input"
        />
        <div className="dictionary-count">
          {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'}
        </div>
      </div>
      
      {/* Word list */}
      <div className="dictionary-word-list">
        {filteredWords.map(word => {
          const entries = groupedEntries[word];
          const isExpanded = !!expandedWords[word];
          
          return (
            <div key={word} className="dictionary-word-item">
              {/* Word header - clickable to expand */}
              <div 
                className={`dictionary-word-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(word)}
              >
                <div className="dictionary-word-title">
                  {word.charAt(0).toUpperCase() + word.slice(1)}
                  <span className="definition-count">{entries.length > 1 ? ` (${entries.length})` : ''}</span>
                </div>
                <div className="expand-icon">
                  {isExpanded ? '▼' : '►'}
                </div>
              </div>
              
              {/* Expanded definitions */}
              {isExpanded && (
                <div className="dictionary-definitions">
                  {entries.map(entry => {
                    // Get definition data
                    const partOfSpeech = entry.partOfSpeech || 
                                      (entry.disambiguatedDefinition?.partOfSpeech) || 
                                      '';
                    
                    const definition = entry.disambiguatedDefinition?.spanish_equivalent || 
                                      entry.disambiguatedDefinition?.translation || 
                                      entry.disambiguatedDefinition?.definition || 
                                      entry.definition ||
                                      'N/A';
                    
                    const example = entry.contextSentence || 
                                  entry.disambiguatedDefinition?.example || 
                                  entry.example ||
                                  'No example available';
                    
                    const wordSenseId = entry.wordSenseId;

                    return (
                      <div className="definition-item" key={wordSenseId}>
                        <div className="definition-header">
                          <div className="part-of-speech">{partOfSpeech}</div>
                          {onRemoveWord && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDefinition(wordSenseId, word);
                              }}
                              title={`Remove this definition of ${word}`}
                              className="remove-definition-button"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div className="definition-text">
                          <div className="definition-translation">{definition}</div>
                          <div className="definition-example">"{example}"</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

DictionaryTable.propTypes = {
  wordDefinitions: PropTypes.object.isRequired,
  onRemoveWord: PropTypes.func, // optional – only needed if removal UI is desired
};

export default DictionaryTable;