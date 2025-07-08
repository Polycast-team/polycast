// src/App.test.jsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import App from './App';
// Import the actual components AFTER mocking them
import AudioRecorder from './components/AudioRecorder';
import Controls from './components/Controls';
import TranscriptionDisplay from './components/TranscriptionDisplay';

// Mock child components
vi.mock('./components/AudioRecorder', () => ({
  default: vi.fn(() => <div data-testid="mock-audio-recorder">Mock Audio Recorder</div>),
}));
vi.mock('./components/Controls', () => ({
  default: vi.fn(({ onStartRecording, onStopRecording }) => (
    <div data-testid="mock-controls">
      <button onClick={onStartRecording}>Mock Start</button>
      <button onClick={onStopRecording}>Mock Stop</button>
      Mock Controls
    </div>
  )),
}));
vi.mock('./components/TranscriptionDisplay', () => ({
  default: vi.fn(() => <div data-testid="mock-transcription-display">Mock Transcription Display</div>),
}));

// Mock the react-use-websocket hook
vi.mock('react-use-websocket');

describe('App component', () => {
  // Import mocks after vi.mock calls
  // Use the imported components, which are now mocks due to vi.mock
  const MockAudioRecorder = vi.mocked(AudioRecorder);
  const MockControls = vi.mocked(Controls);
  const MockTranscriptionDisplay = vi.mocked(TranscriptionDisplay); // Added mock for consistency

  // Mock return values for the hook
  const mockSendMessage = vi.fn();
  let mockReadyState = ReadyState.CONNECTING;
  let mockLastMessage = null;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Setup the mock implementation
    useWebSocket.mockImplementation(() => ({
      sendMessage: mockSendMessage,
      lastMessage: mockLastMessage,
      readyState: mockReadyState,
    }));
    mockReadyState = ReadyState.CONNECTING; // Default state
    mockLastMessage = null;
  });

  it('renders main heading and initial connecting status', () => {
    mockReadyState = ReadyState.CONNECTING;
    render(<App />);
    // Check if the main heading is present
    const headingElement = screen.getByRole('heading', { name: /Polycast v0\.1/i });
    expect(headingElement).toBeInTheDocument();
    // Check for initial status
    expect(screen.getByText(/Connection Status: Connecting/i)).toBeInTheDocument();
    // Check that mock children are rendered
    expect(screen.getByTestId('mock-audio-recorder')).toBeInTheDocument();
    expect(screen.getByTestId('mock-controls')).toBeInTheDocument();
    expect(screen.getByTestId('mock-transcription-display')).toBeInTheDocument();
    // Ensure the actual components were called (meaning the mocks were used)
    expect(MockAudioRecorder).toHaveBeenCalled();
    expect(MockControls).toHaveBeenCalled();
    expect(MockTranscriptionDisplay).toHaveBeenCalled();
  });

  it('displays connected status when websocket is open', () => {
    mockReadyState = ReadyState.OPEN;
    render(<App />);
    expect(screen.getByText(/Connection Status: Connected/i)).toBeInTheDocument();
  });

  it('displays closed status when websocket is closed', () => {
    mockReadyState = ReadyState.CLOSED;
    render(<App />);
    expect(screen.getByText(/Connection Status: Closed/i)).toBeInTheDocument();
  });

  it('passes correct props to child components', () => {
    mockReadyState = ReadyState.OPEN;
    render(<App />);

    // Check props passed to AudioRecorder
    expect(MockAudioRecorder.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        sendMessage: mockSendMessage,
        isRecording: false, // Initial state
      })
    );

    // Check props passed to Controls
    expect(MockControls.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        readyState: ReadyState.OPEN,
        isRecording: false, // Initial state
        onStartRecording: expect.any(Function),
        onStopRecording: expect.any(Function),
      })
    );
  });

  it('updates isRecording state and passes it down when controls are used', () => {
    render(<App />);

    // Simulate clicking Start in mocked Controls
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Mock Start/i }));
    });

    // Check if state updated and props changed for children
    expect(MockAudioRecorder.mock.lastCall[0]).toEqual(expect.objectContaining({ isRecording: true }));
    expect(MockControls.mock.lastCall[0]).toEqual(expect.objectContaining({ isRecording: true }));

    // Simulate clicking Stop in mocked Controls
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Mock Stop/i }));
    });

    // Check if state updated back and props changed for children
    expect(MockAudioRecorder.mock.lastCall[0]).toEqual(expect.objectContaining({ isRecording: false }));
    expect(MockControls.mock.lastCall[0]).toEqual(expect.objectContaining({ isRecording: false }));
  });

  it('displays error message when websocket encounters an error', () => {
    mockReadyState = ReadyState.CLOSED; // Error often leads to closed state
    // Simulate an error object being set (this happens in the onError handler in App.jsx)
    // We need to trigger the state update that would occur inside the hook's effect/callback
    render(<App />); // Initial render

    // To simulate the error, we need to re-render with the error state set.
    // The easiest way is to imagine the hook provides an error object.
    // However, react-use-websocket doesn't directly return the error object.
    // The App component sets its own internal error state in the onError callback.
    // Let's slightly adjust the mock to simulate this.

    let capturedOnError = null;
    useWebSocket.mockImplementation((url, options) => {
      capturedOnError = options.onError; // Capture the onError handler
      return {
        sendMessage: mockSendMessage,
        lastMessage: mockLastMessage,
        readyState: mockReadyState,
      };
    });

    const { rerender } = render(<App />); // Render with the capturing mock

    // Simulate an error event coming from the WebSocket
    const mockErrorEvent = new Event('error');
    act(() => {
      if (capturedOnError) {
        capturedOnError(mockErrorEvent); // Call the captured onError handler
      }
    });

    // Now the App component's internal error state should be set
    rerender(<App />); // Re-render to reflect state change

    expect(screen.getByText(/WebSocket error: error/i)).toBeInTheDocument();
  });

  // e.g., simulate receiving messages
});
