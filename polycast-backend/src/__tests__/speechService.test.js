const { EventEmitter } = require('events');

describe('speechService', () => {
    let SpeechClientConstructor;
    let mockRecognize;
    let mockStreamingRecognize;
    let mockGetProjectId;
    let mockStream;

    const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

    async function loadService(configOverrides = {}) {
        jest.resetModules();

        mockRecognize = jest.fn().mockResolvedValue([{ results: [] }]);
        mockGetProjectId = jest.fn().mockResolvedValue('test-project');

        mockStream = new EventEmitter();
        mockStream.write = jest.fn();
        mockStream.end = jest.fn();

        mockStreamingRecognize = jest.fn(() => mockStream);

        SpeechClientConstructor = jest.fn(() => ({
            recognize: mockRecognize,
            streamingRecognize: mockStreamingRecognize,
            getProjectId: mockGetProjectId,
        }));

        jest.doMock('@google-cloud/speech', () => ({
            v2: { SpeechClient: SpeechClientConstructor },
        }));

        jest.doMock('../config/config', () => ({
            googleSpeechRecognizer: 'projects/demo/locations/us/recognizers/mock',
            googleSpeechEndpoint: 'us-speech.googleapis.com',
            googleSpeechRegion: 'us',
            ...configOverrides,
        }));

        // eslint-disable-next-line global-require
        return require('../services/speechService');
    }

    test('transcribeAudio throws for empty buffer', async () => {
        const speechService = await loadService();
        await expect(speechService.transcribeAudio(null)).rejects.toThrow('Audio buffer is empty or invalid.');
        await expect(speechService.transcribeAudio(Buffer.from(''))).rejects.toThrow('Audio buffer is empty or invalid.');
        expect(mockRecognize).not.toHaveBeenCalled();
    });

    test('transcribeAudio sends request with chirp_3 config and returns transcript', async () => {
        const speechService = await loadService();
        mockRecognize.mockResolvedValue([
            {
                results: [
                    { alternatives: [{ transcript: 'Hello there' }], isFinal: true },
                    { alternatives: [{ transcript: 'General Kenobi' }], isFinal: true },
                ],
            },
        ]);

        const audio = Buffer.from('audio-bytes');
        const transcript = await speechService.transcribeAudio(audio);

        expect(transcript).toBe('Hello there General Kenobi');

        expect(SpeechClientConstructor).toHaveBeenCalledWith({
            apiEndpoint: 'us-speech.googleapis.com',
        });

        expect(mockRecognize).toHaveBeenCalledTimes(1);
        const [request, callOptions] = mockRecognize.mock.calls[0];
        expect(request.recognizer).toBe('projects/demo/locations/us/recognizers/mock');
        expect(request.audio.content).toBeInstanceOf(Buffer);
        expect(request.config).toMatchObject({
            model: 'chirp_3',
            languageCodes: ['en-US'],
            explicitDecodingConfig: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                audioChannelCount: 1,
            },
        });
        expect(callOptions.otherArgs.headers['x-goog-request-params'])
            .toBe('recognizer=projects/demo/locations/us/recognizers/mock');
    });

    test('resolves project ID when recognizer id is short form', async () => {
        const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT;

        try {
            const speechService = await loadService({
                googleSpeechRecognizer: 'short-name',
            });

            const audio = Buffer.from('abc');
            await speechService.transcribeAudio(audio);

            expect(mockGetProjectId).toHaveBeenCalledTimes(1);
            const [request] = mockRecognize.mock.calls[0];
            expect(request.recognizer).toBe('projects/test-project/locations/us/recognizers/short-name');
        } finally {
            if (previousProject !== undefined) {
                process.env.GOOGLE_CLOUD_PROJECT = previousProject;
            } else {
                delete process.env.GOOGLE_CLOUD_PROJECT;
            }
        }
    });

    test('createStreamingSession queues audio until stream ready and forwards transcripts', async () => {
        const speechService = await loadService();
        const transcripts = [];
        const errors = [];

        const session = speechService.createStreamingSession(
            (text, isInterim) => transcripts.push({ text, isInterim }),
            (err) => errors.push(err),
        );

        const chunk = Buffer.from([1, 2, 3, 4]);
        session.send(chunk);

        await flushAsync();

        expect(mockStreamingRecognize).toHaveBeenCalledTimes(1);
        const [callOptions] = mockStreamingRecognize.mock.calls[0];
        expect(callOptions.otherArgs.headers['x-goog-request-params'])
            .toBe('recognizer=projects/demo/locations/us/recognizers/mock');

        expect(mockStream.write).toHaveBeenCalledTimes(2);
        const firstCallPayload = mockStream.write.mock.calls[0][0];
        expect(firstCallPayload).toHaveProperty('recognizer', 'projects/demo/locations/us/recognizers/mock');
        expect(firstCallPayload.streamingConfig.config.model).toBe('chirp_3');
        expect(firstCallPayload.streamingConfig.streamingFeatures.interimResults).toBe(true);

        const secondCallPayload = mockStream.write.mock.calls[1][0];
        expect(secondCallPayload.audio).toBeInstanceOf(Buffer);
        expect(secondCallPayload.audio.equals(chunk)).toBe(true);

        mockStream.emit('data', {
            results: [
                { alternatives: [{ transcript: 'Testing' }], isFinal: false },
                { alternatives: [{ transcript: '123' }], isFinal: true },
            ],
        });

        expect(transcripts).toEqual([
            { text: 'Testing', isInterim: true },
            { text: '123', isInterim: false },
        ]);

        session.close();
        expect(mockStream.end).toHaveBeenCalled();
        expect(errors).toEqual([]);
    });

    test('createStreamingSession surfaces stream errors', async () => {
        const speechService = await loadService();
        const errors = [];

        speechService.createStreamingSession(
            () => {},
            (err) => errors.push(err),
        );

        await flushAsync();

        const sampleError = new Error('stream failed');
        mockStream.emit('error', sampleError);

        expect(errors).toEqual([sampleError]);
    });

    test('loads inline credentials when provided', async () => {
        const previousJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        try {
            process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
                client_email: 'service-account@test-project.iam.gserviceaccount.com',
                private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
                project_id: 'inline-project',
            });

            const speechService = await loadService();
            await speechService.transcribeAudio(Buffer.from('hi'));

            expect(SpeechClientConstructor).toHaveBeenCalledWith({
                apiEndpoint: 'us-speech.googleapis.com',
                credentials: {
                    client_email: 'service-account@test-project.iam.gserviceaccount.com',
                    private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
                },
                projectId: 'inline-project',
            });
        } finally {
            if (previousJson !== undefined) {
                process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = previousJson;
            } else {
                delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
            }
        }
    });
});
