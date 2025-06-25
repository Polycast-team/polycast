import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Shared calendar modal component for flashcards
 * Shows upcoming due dates for the next 8 days
 */
const FlashcardCalendarModal = ({ 
  calendarData, 
  showCalendar, 
  setShowCalendar,
  processedCards,
  dueCards,
  calendarUpdateTrigger 
}) => {
  // Calendar data tracking for internal updates
  useEffect(() => {
    // Calendar data updated - internal tracking only
  }, [calendarData, processedCards, dueCards, calendarUpdateTrigger]);

  if (!showCalendar) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '95vw',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>📅 Next 8 Days</h3>
          <button 
            onClick={() => setShowCalendar(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>
        <div style={{
          overflow: 'auto',
          padding: '10px'
        }}>
          {calendarData.map((day, index) => (
            <div key={index} style={{
              padding: '12px 15px',
              margin: '5px 0',
              backgroundColor: day.cards.length > 0 ? '#f0f9ff' : '#f8f9fa',
              borderRadius: '8px',
              borderLeft: `4px solid ${day.cards.length > 0 ? '#2196f3' : '#e5e7eb'}`
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: day.cards.length > 0 ? '8px' : '0'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                    {day.dayName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {day.dateStr}
                  </div>
                </div>
                <div style={{
                  backgroundColor: day.cards.length > 0 ? '#2196f3' : '#9ca3af',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {day.cards.length} cards
                </div>
              </div>
              {day.cards.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {day.cards.slice(0, 3).map(card => card.word).join(', ')}
                  {day.cards.length > 3 && ` +${day.cards.length - 3} more`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

FlashcardCalendarModal.propTypes = {
  calendarData: PropTypes.array.isRequired,
  showCalendar: PropTypes.bool.isRequired,
  setShowCalendar: PropTypes.func.isRequired,
  processedCards: PropTypes.array.isRequired,
  dueCards: PropTypes.array.isRequired,
  calendarUpdateTrigger: PropTypes.number.isRequired
};

export default FlashcardCalendarModal;