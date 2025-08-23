import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSRSSettings, saveSRSSettings, resetSRSSettings, DEFAULT_SRS_SETTINGS } from '../utils/srsSettings';

const SRSSettings = ({ onClose, onSettingsChange }) => {
  const [settings, setSettings] = useState(getSRSSettings());
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');

  useEffect(() => {
    // Check if settings have changed from defaults
    const defaultSettings = DEFAULT_SRS_SETTINGS;
    const hasChangesFromDefault = JSON.stringify(settings) !== JSON.stringify(defaultSettings);
    setHasChanges(hasChangesFromDefault);
  }, [settings]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    const success = saveSRSSettings(settings);
    if (success) {
      onSettingsChange && onSettingsChange(settings);
      onClose && onClose();
    } else {
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      const defaultSettings = resetSRSSettings();
      setSettings(defaultSettings);
      onSettingsChange && onSettingsChange(defaultSettings);
    }
  };

  const formatLearningSteps = (steps) => {
    return steps.map(step => {
      if (step < 60) return `${step}m`;
      const hours = Math.floor(step / 60);
      const mins = step % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }).join(' → ');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#2a2a3e',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        color: '#fff'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: 0 }}>SRS Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '24px',
          borderBottom: '1px solid #444'
        }}>
          {[
            { id: 'daily', label: 'Daily Limits' },
            { id: 'timing', label: 'Learning Steps' },
            { id: 'advanced', label: 'Advanced' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab.id ? '#4CAF50' : '#999',
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #4CAF50' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Daily Limits Tab */}
        {activeTab === 'daily' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                New Cards Per Day
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.newCardsPerDay}
                onChange={(e) => handleSettingChange('newCardsPerDay', parseInt(e.target.value) || 0)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Maximum new cards to learn each day (0-50)
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Maximum Reviews Per Day
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={settings.maxReviewsPerDay}
                onChange={(e) => handleSettingChange('maxReviewsPerDay', parseInt(e.target.value) || 100)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Maximum review cards per day (10-1000)
              </div>
            </div>
          </div>
        )}

        {/* Learning Steps Tab */}
        {activeTab === 'timing' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Learning Steps (minutes)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                {settings.learningSteps.map((step, index) => (
                  <React.Fragment key={index}>
                    <input
                      type="number"
                      min="1"
                      max="10080"
                      value={step}
                      onChange={(e) => {
                        const newSteps = [...settings.learningSteps];
                        newSteps[index] = parseInt(e.target.value) || 1;
                        handleSettingChange('learningSteps', newSteps);
                      }}
                      style={{
                        width: '70px',
                        padding: '6px',
                        borderRadius: '4px',
                        border: '1px solid #444',
                        background: '#1a1a2e',
                        color: '#fff'
                      }}
                    />
                    {index < settings.learningSteps.length - 1 && <span>→</span>}
                    {settings.learningSteps.length > 1 && (
                      <button
                        onClick={() => {
                          const newSteps = settings.learningSteps.filter((_, i) => i !== index);
                          if (newSteps.length > 0) {
                            handleSettingChange('learningSteps', newSteps);
                          }
                        }}
                        style={{
                          background: '#d32f2f',
                          border: 'none',
                          color: 'white',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </React.Fragment>
                ))}
                <button
                  onClick={() => {
                    const newSteps = [...settings.learningSteps, 10];
                    handleSettingChange('learningSteps', newSteps);
                  }}
                  style={{
                    background: '#4CAF50',
                    border: 'none',
                    color: 'white',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Current sequence: {formatLearningSteps(settings.learningSteps)} → Graduate
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Graduating Interval (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.graduatingInterval}
                onChange={(e) => handleSettingChange('graduatingInterval', parseInt(e.target.value) || 1)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Days before first review after graduating from learning
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Easy Interval (days)
              </label>
              <input
                type="number"
                min="2"
                max="30"
                value={settings.easyInterval}
                onChange={(e) => handleSettingChange('easyInterval', parseInt(e.target.value) || 4)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Days before review when marking new card as "Easy"
              </div>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Starting Ease Factor
              </label>
              <input
                type="number"
                min="1.3"
                max="5.0"
                step="0.1"
                value={settings.startingEase}
                onChange={(e) => handleSettingChange('startingEase', parseFloat(e.target.value) || 2.5)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Default difficulty factor for new cards (1.3-5.0)
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Lapse Multiplier
              </label>
              <input
                type="number"
                min="0.1"
                max="1.0"
                step="0.1"
                value={settings.lapseMultiplier}
                onChange={(e) => handleSettingChange('lapseMultiplier', parseFloat(e.target.value) || 0.5)}
                style={{
                  width: '100px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#1a1a2e',
                  color: '#fff'
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Factor to reduce interval when card fails (0.1-1.0)
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.showNextReviewTime}
                  onChange={(e) => handleSettingChange('showNextReviewTime', e.target.checked)}
                />
                <span>Show next review time on answer buttons</span>
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.showProgress}
                  onChange={(e) => handleSettingChange('showProgress', e.target.checked)}
                />
                <span>Show progress statistics</span>
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #444'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reset to Defaults
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

SRSSettings.propTypes = {
  onClose: PropTypes.func,
  onSettingsChange: PropTypes.func
};

export default SRSSettings;