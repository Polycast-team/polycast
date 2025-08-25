import React from 'react';
import PropTypes from 'prop-types';

// Queue-style calendar modal (Spotify-like)
const FlashcardCalendarModal = ({ showCalendar, setShowCalendar, queue, onReorder }) => {
  if (!showCalendar) return null;

  // Helper: compute day label by index
  const getDayLabel = (index) => {
    const bucket = Math.floor(index / 5);
    if (bucket === 0) return 'Today';
    if (bucket === 1) return 'Tomorrow';
    return `+${bucket} days`;
  };

  // Drag and drop handlers
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    const ids = queue.map(q => q.wordSenseId);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(from, 1);
    newIds.splice(to, 0, moved);
    onReorder && onReorder(newIds);
  };

  const rowBg = (index) => (Math.floor(index / 5) === 0 ? 'rgba(59,130,246,0.08)' : 'transparent');

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#161821', color: '#f8fafc', borderRadius: 12, maxWidth: '900px', width: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2b2f42', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>Queue</div>
          <button onClick={() => setShowCalendar(false)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflow: 'auto' }}>
          {queue.map((item, idx) => (
            <div key={item.wordSenseId}
                 draggable
                 onDragStart={(e) => handleDragStart(e, item.wordSenseId)}
                 onDragOver={handleDragOver}
                 onDrop={(e) => handleDrop(e, item.wordSenseId)}
                 style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 16px', borderBottom: '1px solid #2b2f42', backgroundColor: rowBg(idx) }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 70 }}>{getDayLabel(idx)}</span>
                  {/* Frequency dots */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: n <= Math.max(1, Math.min(5, Math.ceil((item.frequency||5)/2))) ? '#10b981' : '#334155', opacity: n <= Math.max(1, Math.min(5, Math.ceil((item.frequency||5)/2))) ? 1 : 0.5 }} />
                    ))}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{item.translation || item.word}</div>
                <div style={{ opacity: 0.9, fontSize: 13 }}>{item.definition || '—'}</div>
                {item.example && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#a5b4fc' }} dangerouslySetInnerHTML={{ __html: item.example.replace(/~([^~]+)~/g, '<span style="color:#fde047;font-weight:700">$1</span>') }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: 'grab', userSelect: 'none' }}>
                <div style={{ width: 14, height: 2, background: '#64748b', margin: 2 }} />
                <div style={{ width: 14, height: 2, background: '#64748b', margin: 2 }} />
                <div style={{ width: 14, height: 2, background: '#64748b', margin: 2 }} />
              </div>
            </div>
          ))}
          {queue.length === 0 && (
            <div style={{ padding: 20, color: '#94a3b8' }}>No new cards in queue.</div>
          )}
        </div>
      </div>
    </div>
  );
};

FlashcardCalendarModal.propTypes = {
  showCalendar: PropTypes.bool.isRequired,
  setShowCalendar: PropTypes.func.isRequired,
  queue: PropTypes.array.isRequired,
  onReorder: PropTypes.func
};

export default FlashcardCalendarModal;