import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DictionaryTable.css';
import TBAPopup from './popups/TBAPopup';
import { useTBAHandler } from '../hooks/useTBAHandler';


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

// Frequency dot indicator component for reuse
const FrequencyDots = ({ frequency, showValue = false, size = 8, gap = 2 }) => {
  // Color based on rating
  const colors = {
    1: '#ff4d4d', // Red (uncommon)
    2: '#ff944d', // Orange 
    3: '#ffdd4d', // Yellow
    4: '#75d147', // Light green
    5: '#4ade80', // Green (common)
  };
  
  // Generate dots
  const dots = [];
  for (let i = 1; i <= 5; i++) {
    dots.push(
      <div 
        key={i}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: i <= frequency ? colors[frequency] : '#39394d',
          opacity: i <= frequency ? 1 : 0.4,
          margin: `0 ${gap}px`,
          display: 'inline-block'
        }}
      />
    );
  }
  
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {dots}
      {showValue && <span style={{ color: '#a0a0b8', fontSize: '12px', marginLeft: '6px' }}>{frequency}/5</span>}
    </div>
  );
};

FrequencyDots.propTypes = {
  frequency: PropTypes.number.isRequired,
  showValue: PropTypes.bool,
  size: PropTypes.number,
  gap: PropTypes.number
};

// Legend component for frequency explanation
const FrequencyLegend = () => {
  return (
    <div className="frequency-legend" style={{
      marginTop: '10px',
      padding: '10px',
      borderRadius: '8px',
      backgroundColor: '#252533',
      fontSize: '12px',
      color: '#a0a0b8'
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Frequency Guide:</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4d4d' }} />
          <span>1: Rare</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff944d' }} />
          <span>2: Uncommon</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffdd4d' }} />
          <span>3: Moderate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#75d147' }} />
          <span>4: Common</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80' }} />
          <span>5: Very Common</span>
        </div>
      </div>
    </div>
  );
};

const DictionaryTable = ({ wordDefinitions, onRemoveWord, onAddWord }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWords, setExpandedWords] = useState({});
  const [groupedEntries, setGroupedEntries] = useState({});
  const [sortMethod, setSortMethod] = useState('alphabetical'); // 'alphabetical', 'frequency-asc', 'frequency-desc'
  const [showFrequencyLegend, setShowFrequencyLegend] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState([1, 5]); // Min and max frequency to show
  const [selectedWordIndex, setSelectedWordIndex] = useState(-1); // For keyboard navigation
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [newWordInput, setNewWordInput] = useState('');
  const [isAddingWord, setIsAddingWord] = useState(false);
  const searchInputRef = React.useRef(null);
  const addWordInputRef = React.useRef(null);
  const {tba: popupTBA, showTBA, clearTBA} = useTBAHandler();


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
  
  // Get word frequency function
  const getWordFrequency = (word) => {
    const entries = groupedEntries[word] || [];
    const firstEntry = entries[0] || {};
    
    // Check for new frequencyRating field (1-10 scale) from Gemini
    const frequencyRating = firstEntry?.frequencyRating;
    if (frequencyRating) {
      // Convert 1-10 scale to 1-5 scale for display
      // 10,9 → 5 dots, 8,7 → 4 dots, 6,5 → 3 dots, 4,3 → 2 dots, 2,1 → 1 dot
      if (frequencyRating >= 9) return 5;
      if (frequencyRating >= 7) return 4;
      if (frequencyRating >= 5) return 3;
      if (frequencyRating >= 3) return 2;
      return 1;
    }
    
    // Fallback to old logic if no frequencyRating available
    const frequency = firstEntry?.disambiguatedDefinition?.wordFrequency || null;
    if (frequency) {
      return parseInt(frequency, 10);
    }
    
    // Final fallback: generate a consistent frequency rating
    const sum = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (sum % 5) + 1;
  };
  
  // Filter words based on search term and frequency filter
  const filteredWords = Object.keys(groupedEntries)
    .filter(word => {
      const wordFrequency = getWordFrequency(word);
      return word.includes(searchTerm.toLowerCase()) && 
             wordFrequency >= frequencyFilter[0] && 
             wordFrequency <= frequencyFilter[1];
    });
    
  // Sort filtered words based on selected sort method
  const sortedWords = [...filteredWords].sort((a, b) => {
    switch (sortMethod) {
      case 'frequency-asc':
        return getWordFrequency(a) - getWordFrequency(b);
      case 'frequency-desc':
        return getWordFrequency(b) - getWordFrequency(a);
      case 'alphabetical':
      default:
        return a.localeCompare(b);
    }
  });
  
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
    setSelectedWordIndex(-1); // Reset selection when search changes
  };
  
  // Keyboard navigation handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only respond if we're not in an input field (except the search input)
      const activeElement = document.activeElement;
      const isInOtherInput = activeElement.tagName === 'INPUT' && activeElement !== searchInputRef.current;
      
      if (isInOtherInput || activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedWordIndex(prev => {
            if (prev < sortedWords.length - 1) {
              return prev + 1;
            }
            return prev;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedWordIndex(prev => {
            if (prev > 0) {
              return prev - 1;
            } else if (prev === -1 && sortedWords.length > 0) {
              return 0;
            }
            return prev;
          });
          break;
          
        case 'Enter':
        case ' ': // Space key
          if (selectedWordIndex >= 0 && selectedWordIndex < sortedWords.length) {
            e.preventDefault();
            const selectedWord = sortedWords[selectedWordIndex];
            toggleExpand(selectedWord);
          }
          break;
          
        case '/': // Shortcut to focus search
          if (activeElement !== searchInputRef.current) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
          
        case 'Escape':
          if (activeElement === searchInputRef.current) {
            e.preventDefault();
            searchInputRef.current.blur();
            setSearchTerm('');
          } else {
            setSelectedWordIndex(-1);
          }
          break;
          
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedWords, selectedWordIndex, toggleExpand]);
  
  // Function to handle removing a definition
  const handleRemoveDefinition = (wordSenseId, word) => {
    if (onRemoveWord) {
      onRemoveWord(wordSenseId, word);
    }
  };

  // Function to handle manually adding a word
  const handleAddWord = async (e) => {
    e.preventDefault();
    
    const word = newWordInput.trim();
    
    if (!word) {
      return;
    }

    setIsAddingWord(true);
    
    try {
      if (onAddWord) {
        await onAddWord(word);
        setNewWordInput('');
      }
    } catch (error) {
      console.error('Error adding word:', error);
      alert(error.message || `Failed to add "${word}". Please try again.`);
    } finally {
      setIsAddingWord(false);
    }
  };

  // Handle input change for new word
  const handleNewWordInputChange = (e) => {
    setNewWordInput(e.target.value);
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
        
        {/* Add Word Form - Always visible */}
        <div className="add-word-form" style={{ 
          padding: '10px 16px', 
          borderBottom: '1px solid #39394d',
          backgroundColor: '#1e1e2e'
        }}>
          <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Type English word to add to dictionary..."
              value={newWordInput}
              onChange={handleNewWordInputChange}
              ref={addWordInputRef}
              disabled={isAddingWord}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#252533',
                color: '#f5f5f5',
                border: '1px solid #39394d',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <button
              type="submit"
              disabled={!newWordInput.trim() || isAddingWord}
              style={{
                padding: '8px 16px',
                backgroundColor: newWordInput.trim() ? '#5f72ff' : '#39394d',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: newWordInput.trim() && !isAddingWord ? 'pointer' : 'not-allowed',
                opacity: isAddingWord ? 0.7 : 1
              }}
            >
              {isAddingWord ? '...' : '+ Add Word'}
            </button>
          </form>
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
          placeholder="Search words... (Press '/' to focus)"
          value={searchTerm}
          onChange={handleSearchChange}
          className="dictionary-search-input"
          ref={searchInputRef}
        />
        <div className="dictionary-count">
          {sortedWords.length} {sortedWords.length === 1 ? 'word' : 'words'}
        </div>
      </div>
      
      {/* Add Word Form */}
      <div className="add-word-form" style={{ 
        padding: '10px 16px', 
        borderBottom: '1px solid #39394d',
        backgroundColor: '#1e1e2e'
      }}>
        <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Type English word to add to dictionary..."
            value={newWordInput}
            onChange={handleNewWordInputChange}
            ref={addWordInputRef}
            disabled={isAddingWord}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#252533',
              color: '#f5f5f5',
              border: '1px solid #39394d',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            type="submit"
            disabled={!newWordInput.trim() || isAddingWord}
            style={{
              padding: '8px 16px',
              backgroundColor: newWordInput.trim() ? '#5f72ff' : '#39394d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: newWordInput.trim() && !isAddingWord ? 'pointer' : 'not-allowed',
              opacity: isAddingWord ? 0.7 : 1
            }}
          >
            {isAddingWord ? '...' : '+ Add Word'}
          </button>
        </form>
      </div>
      
      {/* Controls */}
      <div className="dictionary-controls" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sort-controls">
          <label style={{ color: '#a0a0b8', fontSize: '14px', marginRight: '8px' }}>Sort by:</label>
          <select 
            value={sortMethod} 
            onChange={(e) => setSortMethod(e.target.value)}
            style={{
              backgroundColor: '#252533',
              color: '#f5f5f5',
              border: '1px solid #39394d',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="alphabetical">Alphabetical (A-Z)</option>
            <option value="frequency-desc">Most Common First</option>
            <option value="frequency-asc">Least Common First</option>
          </select>
        </div>
        
        <div className="frequency-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setShowFrequencyLegend(prev => !prev)}
            style={{
              backgroundColor: showFrequencyLegend ? '#39394d' : 'transparent',
              border: '1px solid #39394d',
              borderRadius: '4px',
              padding: '6px 10px',
              color: '#f5f5f5',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Frequency Guide
          </button>
          
          <div className="keyboard-shortcuts" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowKeyboardShortcuts(prev => !prev)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #39394d',
                borderRadius: '4px',
                padding: '6px 10px',
                color: '#f5f5f5',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ fontSize: '16px' }}>⌨️</span> Keyboard Shortcuts
            </button>
            
            {showKeyboardShortcuts && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '40px',
                width: '300px',
                backgroundColor: '#252533',
                border: '1px solid #39394d',
                borderRadius: '8px',
                padding: '15px',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                animation: 'fadeIn 0.2s ease-in-out'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#f5f5f5' }}>Keyboard Shortcuts</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 15px', fontSize: '14px' }}>
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>/</div>
                  <div style={{ color: '#a0a0b8' }}>Focus search box</div>
                  
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>↑ / ↓</div>
                  <div style={{ color: '#a0a0b8' }}>Navigate between words</div>
                  
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>Enter / Space</div>
                  <div style={{ color: '#a0a0b8' }}>Expand/collapse selected word</div>
                  
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>Escape</div>
                  <div style={{ color: '#a0a0b8' }}>Clear selection or search</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Frequency legend (optional) */}
      {showFrequencyLegend && (
        <div style={{ padding: '0 16px' }}>
          <FrequencyLegend />
        </div>
      )}
      
      {/* Word list */}
      <div className="dictionary-word-list">
        {sortedWords.map((word, index) => {
          const entries = groupedEntries[word];
          const isExpanded = !!expandedWords[word];
          const wordFrequency = getWordFrequency(word);
          const isSelected = index === selectedWordIndex;
          
          return (
            <div 
              key={word} 
              className="dictionary-word-item"
              style={{
                transition: 'all 0.2s ease',
                transform: isExpanded ? 'scale(1.01)' : 'scale(1)',
                boxShadow: isExpanded ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 0 0 rgba(0, 0, 0, 0)',
                border: isSelected ? '1px solid #4ade80' : '1px solid #39394d',
                backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : undefined,
              }}
            >
              {/* Word header - clickable to expand */}
              <div 
                className={`dictionary-word-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(word)}
              >
                <div className="dictionary-word-title">
                  {word.charAt(0).toUpperCase() + word.slice(1)}
                  <span className="definition-count">
                    {entries.length > 1 ? ` ${entries.length} Definitions Found!` : ' 1 Definition Found!'}
                  </span>
                </div>
                <div className="word-metadata" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Frequency rating from 1-5 with color scale */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#a0a0b8', fontSize: '14px', marginRight: '5px' }}>
                      Frequency:
                    </span>
                    <FrequencyDots frequency={wordFrequency} />
                  </div>
                  <div className="expand-icon" style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M3 2L8 6L3 10" 
                        stroke="#a0a0b8" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Expanded definitions */}
              {isExpanded && (
                <div className="dictionary-definitions" style={{ paddingLeft: '20px', paddingRight: '10px' }}>
                  {entries.map(entry => {
                    // Get definition data
                    const partOfSpeech = entry.partOfSpeech || 
                                      (entry.disambiguatedDefinition?.partOfSpeech) || 
                                      '';
                    
                    const definition = entry.translation || 
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
                          <div className="definition-header-left">
                            <div className="part-of-speech">{partOfSpeech}</div>
                            {/* Usage frequency for this specific definition */}
                            {(() => {
                              const usageFrequency = entry?.disambiguatedDefinition?.definitions?.[0]?.usageFrequency || 
                                                   entry?.disambiguatedDefinition?.usageFrequency;
                              
                              if (usageFrequency) {
                                // Get a text description of the frequency
                                const frequencyText = {
                                  1: 'Very Rare Usage',
                                  2: 'Uncommon Usage',
                                  3: 'Secondary Usage',
                                  4: 'Common Usage',
                                  5: 'Primary Usage'
                                }[parseInt(usageFrequency, 10)] || '';
                                
                                return (
                                  <div className="usage-frequency" style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginLeft: '12px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    gap: '8px'
                                  }}>
                                    <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>
                                      Definition Frequency: 
                                    </span>
                                    <FrequencyDots frequency={parseInt(usageFrequency, 10)} size={8} showValue={false} />
                                    <span style={{ color: '#a0a0b8', fontSize: '13px' }}>
                                      {frequencyText}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
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
                          <div className="definition-translation" style={{ 
                            fontSize: '16px',
                            lineHeight: '1.6',
                            marginBottom: '10px',
                            fontWeight: '500'
                          }}>
                            {definition}
                          </div>
                          <div className="definition-example" style={{ 
                            fontStyle: 'italic',
                            backgroundColor: 'rgba(74, 222, 128, 0.08)',
                            padding: '10px 15px',
                            borderRadius: '6px',
                            borderLeft: '3px solid rgba(74, 222, 128, 0.5)',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            color: '#c4c4d4'
                          }}>
                            <span style={{ fontWeight: 'bold', color: '#a0a0b8' }}>Example:</span> "{example}"
                          </div>
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
      {/* TBA Popup */}
      <TBAPopup tba={popupTBA} onClose={clearTBA} />
    </div>
  );
};

DictionaryTable.propTypes = {
  wordDefinitions: PropTypes.object.isRequired,
  onRemoveWord: PropTypes.func, // optional – only needed if removal UI is desired
  onAddWord: PropTypes.func, // optional – only needed if manual word addition is desired
};

export default DictionaryTable;