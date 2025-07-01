/**
 * Shared audio functionality for flashcards
 * Handles TTS generation and playback
 */

export async function playFlashcardAudio(word, currentAudio, setCurrentAudio, setAudioState) {
  setAudioState({ loading: true, error: null });

  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const response = await fetch('https://polycast-server.onrender.com/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word })
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onplay = () => setAudioState({ loading: false, error: null });
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      setCurrentAudio(null);
    };
    audio.onerror = () => {
      setAudioState({ loading: false, error: 'Audio playback failed' });
      URL.revokeObjectURL(audioUrl);
      setCurrentAudio(null);
    };

    setCurrentAudio(audio);
    await audio.play();
  } catch (error) {
    console.error('TTS Error:', error);
    setAudioState({ loading: false, error: 'Failed to generate audio' });
  }
}