// Placeholder test file

describe('Server Setup', () => {
  test('should pass this basic test', () => {
    expect(true).toBe(true);
  });
});

const request = require('supertest');
const WebSocket = require('ws');
const sdk = require('microsoft-cognitiveservices-speech-sdk'); // Import SDK for ResultReason
const { server, wss } = require('../server'); // Import the exported server and wss
const config = require('../config/config');
const speechService = require('../services/speechService'); // Import service to mock

// Mock the speech service
jest.mock('../services/speechService', () => ({
    startRecognitionForClient: jest.fn(),
    stopRecognitionForClient: jest.fn(),
    pushAudioChunkForClient: jest.fn(),
}));

// Mock the spawn function from child_process used for FFmpeg
jest.mock('child_process', () => ({
    spawn: jest.fn(() => ({
        pid: 12345, // Mock PID
        stdin: { pipe: jest.fn(), on: jest.fn(), end: jest.fn() },
        stdout: { pipe: jest.fn(), on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
             // Immediately trigger 'close' for simplicity in some tests if needed,
             // or setup specific triggers per test case.
             // if (event === 'close') {
             //     setTimeout(() => cb(0, null), 10); // Simulate clean exit shortly after spawn
             // }
        }),
        kill: jest.fn(),
    })),
}));

// Keep track of the actual handleRecognized callback passed to the mock
let capturedHandleRecognized;

// Enhance the mock implementation to capture the callback
const mockStartRecognition = jest.fn((ws, onRecognizing, onRecognized, onError) => {
    console.log('Mock speechService.startRecognitionForClient called');
    capturedHandleRecognized = onRecognized; // Capture the function
});
speechService.startRecognitionForClient.mockImplementation(mockStartRecognition);

// Silence console logs/errors during tests unless needed for debugging
let consoleLogSpy;
let consoleErrorSpy;
// beforeEach(() => {
//     consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
//     consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
// });
// afterEach(() => {
//     consoleLogSpy.mockRestore();
//     consoleErrorSpy.mockRestore();
//     jest.restoreAllMocks(); // Restore other mocks too
// });

// Increase Jest timeout for async operations like server start/stop
jest.setTimeout(10000); // 10 seconds

describe('Server WebSocket Communication', () => {
    let testServer;
    let wsClient;

    // Start the server before running tests
    beforeAll((done) => {
        // Ensure any previous instance is closed before starting
        server.close(() => { 
            testServer = server.listen(config.port, done);
        });
        // Handle case where server wasn't running initially
        server.on('error', (err) => {
            if (err.code === 'ERR_SERVER_NOT_RUNNING') {
                testServer = server.listen(config.port, done);
            } else {
                done(err);
            }
        });
    });

    // Close the server and WebSocket client after tests
    afterAll((done) => {
        wss.clients.forEach(client => client.terminate()); // Terminate any open WS clients
        wss.close(() => { // Close the WebSocket server
            if (testServer) {
                testServer.close(done); // Close the HTTP server
            } else {
                done(); // Server might not have started if beforeAll failed
            }
        });
    });

    // Ensure mocks are cleared and client connected before each test
    beforeEach(async () => { // Make beforeEach async
        jest.clearAllMocks();
        capturedHandleRecognized = null; // Reset captured callback

        await new Promise((resolve, reject) => {
            const wsUrl = `ws://localhost:${config.port}`;
            wsClient = new WebSocket(wsUrl);
            wsClient.on('open', () => {
                // Wait a moment for server to process connection and set callback
                setTimeout(() => {
                    if (capturedHandleRecognized) {
                        resolve();
                    } else {
                        // If callback not set after short delay, try again or fail
                         setTimeout(() => {
                             if (capturedHandleRecognized) { 
                                 resolve(); 
                             } else { 
                                 reject(new Error('handleRecognized callback not captured')); 
                             }
                         }, 100); // Increased delay slightly
                    }
                }, 100); // Increased delay slightly
            });
            wsClient.on('error', (err) => reject(err));
        });
    });

    // Close WebSocket client after each test
    afterEach(() => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
        if (consoleLogSpy) consoleLogSpy.mockRestore(); // Restore console.log
    });

    test('GET / should return 200 OK', async () => {
        const response = await request(testServer).get('/');
        expect(response.statusCode).toBe(200);
        expect(response.text).toBe('Polycast Backend Server is running.');
    });

    test('WebSocket connection established and receives info message', (done) => {
        let infoMessageReceived = false;
        wsClient.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString());
                if (parsedMessage.type === 'info') {
                    expect(parsedMessage.message).toContain('Connected to Polycast backend');
                    infoMessageReceived = true;
                    done(); // Test complete once info message is verified
                }
            } catch (error) {
                done(error);
            }
        });
        // Timeout if info message isn't received
        setTimeout(() => {
             if (!infoMessageReceived) done(new Error('Info message not received'));
        }, 200); 
    });

    // Remove the old Whisper test
    // test('WebSocket should process received audio message via WhisperService', ...);
});

// New test suite for segmentation
describe('Segmentation Logic (Phase 1.5)', () => {
    let testServer;
    let wsClient;
    let receivedMessages = [];
    let consoleLogSpy; // Define spy variable here

    // --- Server Setup/Teardown (Similar to above) ---
    beforeAll((done) => {
         // Ensure any previous instance is closed before starting
         server.close(() => { 
            testServer = server.listen(config.port, done);
        });
        // Handle case where server wasn't running initially
        server.on('error', (err) => {
            if (err.code === 'ERR_SERVER_NOT_RUNNING') {
                testServer = server.listen(config.port, done);
            } else {
                done(err);
            }
        });
    });
    afterAll((done) => {
        wss.clients.forEach(client => client.terminate());
        wss.close(() => { 
            if (testServer) {
                testServer.close(done); 
            } else {
                done();
            }
        });
    });

    // --- Test Setup/Teardown ---
    beforeEach(async () => { // Make beforeEach async
        jest.clearAllMocks();
        capturedHandleRecognized = null;
        receivedMessages = []; // Clear received messages
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // Setup spy

        await new Promise((resolve, reject) => { // Use async/await with Promise
            const wsUrl = `ws://localhost:${config.port}`;
            wsClient = new WebSocket(wsUrl);

            wsClient.on('message', (message) => {
                receivedMessages.push(JSON.parse(message.toString()));
            });

            wsClient.on('open', () => {
                // Wait for server to process connection and capture callback
                 setTimeout(() => {
                    if (capturedHandleRecognized) {
                         resolve();
                     } else {
                         setTimeout(() => { 
                             if (capturedHandleRecognized) { 
                                 resolve(); 
                             } else { 
                                 reject(new Error('handleRecognized callback not captured')); 
                             }
                         }, 100); // Increased delay
                     }
                 }, 100); // Increased delay
            });
            wsClient.on('error', (err) => reject(err));
        });
    });

    afterEach(() => {
        if (consoleLogSpy) consoleLogSpy.mockRestore(); // Restore console.log
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
    });

    // --- Helper to create mock result object ---
    const createMockResult = (text, offsetMs = 0, durationMs = 0) => {
        const result = {
            text: text,
            reason: sdk.ResultReason.RecognizedSpeech,
            properties: new sdk.PropertyCollection(), // Use actual PropertyCollection
        };
        // Simulate the detailed JSON property if timing is provided
        if (offsetMs > 0 || durationMs > 0) {
            const jsonDetails = JSON.stringify({
                Id: `mock-${Math.random()}`,
                RecognitionStatus: 'Success',
                DisplayText: text,
                Offset: offsetMs * 10000, // Convert ms to 100ns units
                Duration: durationMs * 10000,
                Channel: 0,
            });
            result.properties.setProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult, jsonDetails);
        }
        return result;
    };

    // --- Test Cases ---
    test('should NOT trigger LLM call for short phrase without punctuation/pause', () => {
        const result1 = createMockResult('Hello there', 50, 800);
        capturedHandleRecognized(wsClient, result1); // Simulate recognition

        // Check: Client receives recognized text
        expect(receivedMessages).toEqual([{ type: 'recognized', data: 'Hello there' }]);
        // Check: Console log for LLM call NOT present
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));
    });

    test('should trigger LLM call on sentence-ending punctuation', () => {
        const result1 = createMockResult('Hello there.', 50, 900);
        capturedHandleRecognized(wsClient, result1);

        expect(receivedMessages).toEqual([{ type: 'recognized', data: 'Hello there.' }]);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Text to send: "Hello there."'));
    });

    test('should trigger LLM call after a significant pause', () => {
        const result1 = createMockResult('First phrase', 50, 1000); // Ends at 1050ms
        capturedHandleRecognized(wsClient, result1);
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));

        // Simulate second phrase after 800ms pause (starts at 1050 + 800 = 1850ms)
        const result2 = createMockResult('second phrase', 1850, 1200);
        capturedHandleRecognized(wsClient, result2);

        // Check: LLM called after second phrase due to pause
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));
        // The text sent should include both phrases because the buffer wasn't cleared before
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Text to send: "First phrase second phrase"'));
        // Check: Client received both recognized messages
        expect(receivedMessages).toEqual([
            { type: 'recognized', data: 'First phrase' },
            { type: 'recognized', data: 'second phrase' },
        ]);
    });

     test('should trigger LLM call when fallback length threshold is met', () => {
        // Simulate multiple short phrases without punctuation or long pauses
        let offset = 50;
        const phrase = 'short bit of text '; // 19 chars
        const duration = 500;
        const pause = 100; // Short pause

        // Send enough phrases to exceed threshold (100 chars)
        for (let i = 0; i < 6; i++) {
            const result = createMockResult(phrase + i, offset, duration);
            capturedHandleRecognized(wsClient, result);
            offset += duration + pause; // Increment offset
             // LLM call should NOT happen yet
             if (i < 5) {
                  expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));
             }
        }

        // Check: LLM call triggered on the 6th phrase due to length
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Sending to LLM'));
        // Check the text accumulated
        let expectedText = '';
        for (let i = 0; i < 6; i++) { expectedText += phrase + i + ' '; }
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Text to send: "${expectedText.trim()}"`));
     });
});
