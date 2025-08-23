import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AudioRecorder from './AudioRecorder';

// Mock MediaRecorder and related browser APIs
let mockMediaRecorderInstance = null;
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockStream = { getTracks: () => [{ stop: vi.fn() }] }; // Mock stream with stoppable tracks

// Spy on console.log/error if needed
// const logSpy = vi.spyOn(console, 'log');
// const errorSpy = vi.spyOn(console, 'error');

global.navigator.mediaDevices = {
  getUserMedia: vi.fn(),
};

class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    mockMediaRecorderInstance = this; // Expose instance for manipulation
  }

  start(timeslice) {
    this.state = 'recording';
    mockStart(timeslice);
    // Simulate data available event after a short delay if needed for testing
    // setTimeout(() => {
    //   if (this.ondataavailable) {
    //     this.ondataavailable({ data: new Blob(['audio data'], { type: 'audio/webm' }) });
    //   }
    // }, 100);
  }

  stop() {
    this.state = 'inactive';
    mockStop();
    // Simulate stop event after a short delay
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 50);
  }
}
global.MediaRecorder = MockMediaRecorder;

describe('AudioRecorder component', () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default successful state
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);
    mockMediaRecorderInstance = null;
  });

  afterEach(() => {
    vi.clearAllMocks(); // Ensure clean slate after tests
  });

  it('renders idle status initially', () => {
    render(<AudioRecorder sendMessage={mockSendMessage} isRecording={false} />);
    expect(screen.getByText(/Status: Idle/i)).toBeInTheDocument();
    expect(global.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('requests microphone access and starts recording when isRecording becomes true', async () => {
    const { rerender } = render(<AudioRecorder sendMessage={mockSendMessage} isRecording={false} />);

    act(() => {
      rerender(<AudioRecorder sendMessage={mockSendMessage} isRecording={true} />);
    });

    // Check for status updates immediately after rerender triggers the effect
    expect(screen.getByText(/Status: Requesting Mic/i)).toBeInTheDocument();

    // Wait for async operations (getUserMedia) and subsequent status update
    await waitFor(() => expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true }));
    await waitFor(() => expect(screen.getByText(/Status: Recording/i)).toBeInTheDocument());

    // Check MediaRecorder interaction
    expect(mockStart).toHaveBeenCalledWith(1000); // Check timeslice
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('stops recording when isRecording becomes false', async () => {
    // Start in recording state
    render(<AudioRecorder sendMessage={mockSendMessage} isRecording={true} />);
    await waitFor(() => expect(screen.getByText(/Status: Recording/i)).toBeInTheDocument());
    expect(mockStart).toHaveBeenCalled();

    // Set isRecording to false
    const { rerender } = render(<AudioRecorder sendMessage={mockSendMessage} isRecording={true} />); // Use initial render for rerender

    act(() => {
      rerender(<AudioRecorder sendMessage={mockSendMessage} isRecording={false} />);
    });

    // Wait for the 'Stopping' status to appear after the rerender triggers the effect
    await waitFor(() => {
      expect(screen.getByText(/Status: Stopping/i)).toBeInTheDocument();
    });

    // Wait for async operations (mediaRecorder.stop()) and subsequent status update
    await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));
    // Wait for the simulated async stop callback
    await waitFor(() => expect(screen.getByText(/Status: Idle/i)).toBeInTheDocument());
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled(); // Check stream track stopped
  });

  it('sends data chunks when available', async () => {
    render(<AudioRecorder sendMessage={mockSendMessage} isRecording={true} />);
    await waitFor(() => expect(mockMediaRecorderInstance).not.toBeNull());

    // Simulate data available event from the mocked instance
    const testBlob = new Blob(['audio data'], { type: 'audio/webm' });
    act(() => {
      if (mockMediaRecorderInstance?.ondataavailable) {
        mockMediaRecorderInstance.ondataavailable({ data: testBlob });
      }
    });

    expect(mockSendMessage).toHaveBeenCalledWith(testBlob);
  });

  it('handles microphone access error', async () => {
    const error = new Error('Permission denied');
    global.navigator.mediaDevices.getUserMedia.mockRejectedValue(error);

    await act(async () => {
      render(<AudioRecorder sendMessage={mockSendMessage} isRecording={true} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Error: Permission denied/i)).toBeInTheDocument();
    });
    expect(mockStart).not.toHaveBeenCalled();
  });

});
