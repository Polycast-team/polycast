const { createClient } = require('@deepgram/sdk');
const { transcribeAudio, createStreamingSession } = require('../services/deepgramService');
const config = require('../config/config');

// Mock the Deepgram SDK
jest.mock('@deepgram/sdk');

// Mock the config module
jest.mock('../config/config', () => ({
    deepgramApiKey: 'test_deepgram_key',
    port: 8088,
}));

// Mock console methods to avoid cluttering test output
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe('Deepgram Service - transcribeAudio', () => {
    let mockAudioBuffer;
    let mockDeepgramClient;
    let mockTranscribeFile;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockAudioBuffer = Buffer.from('fake audio data');

        // Mock the transcribeFile method
        mockTranscribeFile = jest.fn();

        // Mock the Deepgram client structure
        mockDeepgramClient = {
            listen: {
                prerecorded: {
                    transcribeFile: mockTranscribeFile
                }
            }
        };

        // Mock createClient to return our mock client
        createClient.mockReturnValue(mockDeepgramClient);
    });

    test('should call Deepgram API with correct parameters and return transcription', async () => {
        const mockResponse = {
            result: {
                results: {
                    channels: [{
                        alternatives: [{
                            transcript: 'Hello world'
                        }]
                    }]
                }
            }
        };
        mockTranscribeFile.mockResolvedValue(mockResponse);

        const transcription = await transcribeAudio(mockAudioBuffer, 'test.webm');

        expect(createClient).toHaveBeenCalledWith(config.deepgramApiKey);
        expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
        expect(mockTranscribeFile).toHaveBeenCalledWith(
            mockAudioBuffer,
            expect.objectContaining({
                model: 'nova-2',
                language: 'en',
                smart_format: true,
                punctuate: true,
                utterances: false
            })
        );

        expect(transcription).toBe('Hello world');
    });

    test('should throw error if Deepgram API key is not configured', async () => {
        // Temporarily set the key to undefined on the mocked config
        const originalKey = config.deepgramApiKey;
        config.deepgramApiKey = undefined;

        await expect(transcribeAudio(mockAudioBuffer)).rejects.toThrow(
            'Deepgram API key is not configured.'
        );
        expect(mockTranscribeFile).not.toHaveBeenCalled();

        // Restore the key
        config.deepgramApiKey = originalKey;
    });

    test('should throw error if audio buffer is empty or invalid', async () => {
        await expect(transcribeAudio(null)).rejects.toThrow(
            'Audio buffer is empty or invalid.'
        );
        await expect(transcribeAudio(Buffer.from(''))).rejects.toThrow(
            'Audio buffer is empty or invalid.'
        );
        expect(mockTranscribeFile).not.toHaveBeenCalled();
    });

    test('should handle API error response', async () => {
        const errorResponse = {
            status: 401,
            message: 'Invalid API key'
        };
        mockTranscribeFile.mockRejectedValue(errorResponse);

        await expect(transcribeAudio(mockAudioBuffer)).rejects.toThrow(
            'Deepgram API Error: Invalid API key'
        );
        expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
    });

    test('should handle network errors', async () => {
        const networkError = new Error('Network Error');
        networkError.code = 'ENOTFOUND';
        mockTranscribeFile.mockRejectedValue(networkError);

        await expect(transcribeAudio(mockAudioBuffer)).rejects.toThrow(
            'Deepgram API Error: Network connection failed'
        );
        expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
    });

    test('should handle rate limit errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.status = 429;
        mockTranscribeFile.mockRejectedValue(rateLimitError);

        await expect(transcribeAudio(mockAudioBuffer)).rejects.toThrow(
            'Deepgram API Error: Rate limit exceeded'
        );
        expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
    });

    test('should handle empty transcription response', async () => {
        const emptyResponse = {
            result: {
                results: {
                    channels: [{
                        alternatives: [{
                            transcript: ''
                        }]
                    }]
                }
            }
        };
        mockTranscribeFile.mockResolvedValue(emptyResponse);

        const transcription = await transcribeAudio(mockAudioBuffer);
        expect(transcription).toBe('');
    });

    test('should handle malformed API response', async () => {
        const malformedResponse = {
            result: {
                // Missing expected structure
            }
        };
        mockTranscribeFile.mockResolvedValue(malformedResponse);

        const transcription = await transcribeAudio(mockAudioBuffer);
        expect(transcription).toBe('');
    });

    test('should detect MIME type from filename', async () => {
        const mockResponse = {
            result: {
                results: {
                    channels: [{
                        alternatives: [{
                            transcript: 'Test transcription'
                        }]
                    }]
                }
            }
        };
        mockTranscribeFile.mockResolvedValue(mockResponse);

        await transcribeAudio(mockAudioBuffer, 'test.wav');

        // The function should still work regardless of filename
        expect(mockTranscribeFile).toHaveBeenCalledWith(
            mockAudioBuffer,
            expect.objectContaining({
                model: 'nova-2'
            })
        );
    });

    test('should allow custom options override', async () => {
        const mockResponse = {
            result: {
                results: {
                    channels: [{
                        alternatives: [{
                            transcript: 'Custom options test'
                        }]
                    }]
                }
            }
        };
        mockTranscribeFile.mockResolvedValue(mockResponse);

        const customOptions = {
            model: 'base',
            language: 'es'
        };

        await transcribeAudio(mockAudioBuffer, 'test.webm', customOptions);

        expect(mockTranscribeFile).toHaveBeenCalledWith(
            mockAudioBuffer,
            expect.objectContaining({
                model: 'base',
                language: 'es'
            })
        );
    });
});

describe('Deepgram Service - createStreamingSession', () => {
    let mockDeepgramClient;
    let mockConnection;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock connection object
        mockConnection = {
            on: jest.fn(),
            send: jest.fn(),
            finish: jest.fn(),
            getReadyState: jest.fn().mockReturnValue(1) // WebSocket OPEN state
        };

        // Mock the Deepgram client structure for streaming
        mockDeepgramClient = {
            listen: {
                live: {
                    transcription: jest.fn().mockReturnValue(mockConnection)
                }
            }
        };

        createClient.mockReturnValue(mockDeepgramClient);
    });

    test('should create streaming session with correct options', () => {
        const onTranscript = jest.fn();
        const onError = jest.fn();

        const session = createStreamingSession(onTranscript, onError);

        expect(mockDeepgramClient.listen.live.transcription).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'nova-2',
                language: 'en',
                smart_format: true,
                interim_results: true
            })
        );

        expect(session).toHaveProperty('send');
        expect(session).toHaveProperty('close');
        expect(typeof session.send).toBe('function');
        expect(typeof session.close).toBe('function');
    });

    test('should handle streaming transcription results', () => {
        const onTranscript = jest.fn();
        const onError = jest.fn();

        createStreamingSession(onTranscript, onError);

        // Simulate the 'Results' event handler being called
        const resultsHandler = mockConnection.on.mock.calls.find(call => call[0] === 'Results')[1];

        const mockData = {
            channel: {
                alternatives: [{
                    transcript: 'Streaming transcription test'
                }]
            },
            is_final: true
        };

        resultsHandler(mockData);

        expect(onTranscript).toHaveBeenCalledWith('Streaming transcription test', false);
    });

    test('should handle streaming errors', () => {
        const onTranscript = jest.fn();
        const onError = jest.fn();

        createStreamingSession(onTranscript, onError);

        // Simulate the 'error' event handler being called
        const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')[1];
        const testError = new Error('Streaming error');

        errorHandler(testError);

        expect(onError).toHaveBeenCalledWith(testError);
    });
});
