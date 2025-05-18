import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DictionaryTable.css';

// Component to display word frequency rating (1-5)
const FrequencyIndicator = ({ word }) => {
  // In a real app, this would come from actual frequency data
  // For now, we'll generate a random but consistent rating based on the word
  const getWordFrequency = (word) => {
    // Generate a consistent frequency rating between 1-5 based on word
    const sum = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (sum % 5) + 1; // Rating from 1 to 5
  };

  const frequency = getWordFrequency(word);
  
  // Determine color based on frequency (5=green, 1=red)
  const getColorForFrequency = (freq) => {
    const colors = {
      1: '#ff4d4d', // Red
      2: '#ff944d', // Orange
      3: '#ffdd4d', // Yellow
      4: '#75d147', // Light green
      5: '#4ade80', // Green
    };
    return colors[freq] || colors[3]; // Default to yellow if invalid
  };

  // Generate the dots for the rating
  const renderFrequencyDots = (rating) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      dots.push(
        <div 
          key={i}
          className={`frequency-dot ${i <= rating ? 'active' : 'inactive'}`}
          style={{ 
            backgroundColor: i <= rating ? getColorForFrequency(rating) : '#39394d',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block'
          }}
        />
      );
    }
    return dots;
  };

  return (
    <div className="frequency-indicator" title={`Frequency rating: ${frequency}/5`}>
      <div className="frequency-dots" style={{ display: 'flex', gap: '3px' }}>
        {renderFrequencyDots(frequency)}
      </div>
    </div>
  );
};

FrequencyIndicator.propTypes = {
  word: PropTypes.string.isRequired
};

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
    <div className="dictionary-container" style={{ width: '800px', maxWidth: '100%', margin: '0 auto' }}>
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
                <div className="word-metadata" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Frequency rating from 1-5 with color scale */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#a0a0b8', fontSize: '14px', marginRight: '5px' }}>
                      Frequency:
                    </span>
                    {(() => {
                      // Generate a consistent frequency rating between 1-5 based on word
                      const sum = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      const rating = (sum % 5) + 1;
                      
                      // Color based on rating
                      const colors = {
                        1: '#ff4d4d', // Red
                        2: '#ff944d', // Orange
                        3: '#ffdd4d', // Yellow
                        4: '#75d147', // Light green
                        5: '#4ade80', // Green
                      };
                      
                      // Generate dots
                      const dots = [];
                      for (let i = 1; i <= 5; i++) {
                        dots.push(
                          <div 
                            key={i}
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: i <= rating ? colors[rating] : '#39394d',
                              opacity: i <= rating ? 1 : 0.4,
                              margin: '0 2px',
                              display: 'inline-block'
                            }}
                          />
                        );
                      }
                      return <div style={{ display: 'flex', alignItems: 'center' }}>{dots}</div>;
                    })()}
                  </div>
                  <div className="expand-icon">
                    {isExpanded ? '▼' : '►'}
                  </div>
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