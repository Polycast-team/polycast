import React, { useState } from 'react';
import PropTypes from 'prop-types';
import apiService from '../../services/apiService.js';
import { getLanguageForProfile, getNativeLanguageForProfile } from '../../utils/profileLanguageMapping.js';

const AddWordPopup = ({ isOpen, onClose, onSelectSenses, selectedProfile }) => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({});

  if (!isOpen) return null;

  const handleFetch = async (e) => {
    e.preventDefault();
    setError('');
    const term = word.trim();
    if (!term) return;

    try {
      setLoading(true);
      setCandidates([]);
      setSelected({});
      const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
      const targetLanguage = getLanguageForProfile(selectedProfile);
      const url = apiService.getSenseCandidatesUrl(term, nativeLanguage, targetLanguage);
      const data = await apiService.fetchJson(url);
      const listRaw = Array.isArray(data?.senses) ? data.senses.slice(0, 5) : [];
      // Language mismatch sentinel from backend
      if (listRaw.length === 1 && listRaw[0]?.wrongLanguage) {
        setError(`Please input a ${targetLanguage} word.`);
        return;
      }
      const list = listRaw;
      if (list.length === 0) {
        setError('No definitions found. Try a different word or spelling.');
        return;
      }
      setCandidates(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch definitions');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (idx) => {
    setSelected(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const confirm = () => {
    const chosen = candidates.filter((_, idx) => selected[idx]);
    if (chosen.length === 0) {
      setError('Select at least one definition');
      return;
    }
    onSelectSenses(word.trim(), chosen);
    onClose();
  };

  const targetLanguage = getLanguageForProfile(selectedProfile);

  const renderExample = (s='') => s.replace(/~([^~]+)~/g, '<span style="color:#ffde59;font-weight:700">$1<\/span>');

  return (
    <div className="tba-popup-overlay" onClick={onClose}>
      <div className="tba-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="tba-popup-header">
          <div className="tba-popup-icon">📚</div>
          <h3 className="tba-popup-title">Add Word</h3>
          <button className="tba-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="tba-popup-content">
          <form onSubmit={handleFetch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              autoFocus
              type="text"
              placeholder={`Type a word in ${targetLanguage}...`}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={loading}>{loading ? '...' : 'Find Senses'}</button>
          </form>
          {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
          {candidates.length >= 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((s, idx) => (
                <label key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'start', padding: '8px', border: '1px solid #39394d', borderRadius: 8 }}>
                  <input type="checkbox" checked={!!selected[idx]} onChange={() => toggle(idx)} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.translation || '—'}</div>
                    <div style={{ opacity: 0.85 }}>{s.definition || '—'}</div>
                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Example: <span style={{ opacity: 0.9 }} dangerouslySetInnerHTML={{ __html: renderExample(s.example || '') }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#a0a0b8' }}>Freq {s.frequency}/10</div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="tba-popup-actions">
          {candidates.length >= 1 ? (
            <button className="tba-popup-button" onClick={confirm}>Add Selected</button>
          ) : (
            <button className="tba-popup-button" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
};

AddWordPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectSenses: PropTypes.func.isRequired,
  selectedProfile: PropTypes.string.isRequired,
};

export default AddWordPopup;


