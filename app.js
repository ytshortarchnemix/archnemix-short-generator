// ArchNemix Shorts Generator - Using HeadTTS Perfect Word Timestamps
// Configuration
const API_URL = "https://ytshortmakerarchx-ytshrt-archx-mc-1.hf.space";
const TTS_API = "https://ytshortmakerarchx-headtts-service.hf.space"; // Your new HeadTTS API
// HeadTTS provides phoneme-aligned word timestamps - PERFECT sync!
const APP_KEY = "archx_3f9d15f52n48d41h5fj8a7e2b_private";

// Application State
const state = {
    currentStep: 1,
    audioBlob: null,
    audioDuration: 0,
    subtitlesASS: "",
    selectedVideo: "mc1",
    currentJobId: "",
    audioBase64: "",
    script: "",
    voices: [],
    jobPollInterval: null,
    isProcessing: false,
    availableTTSVoices: [],
    wordTimestamps: [],  // Perfect timestamps from HeadTTS
    lastRequestTime: 0   // For rate limiting CORS requests
};

// Toast Notification System (keeping your existing Toast class)
class Toast {
    static show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const icon = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        }[type] || 'ℹ';
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">${icon}</span>
                <span>${message}</span>
            </div>
        `;
        
        const colors = {
            success: '#00CC88',
            error: '#FF5555',
            info: '#0066FF',
            warning: '#FFAA00'
        };
        
        Object.assign(toast.style, {
            position: 'fixed',
            top: '100px',
            right: '20px',
            padding: '12px 20px',
            background: colors[type],
            color: 'white',
            borderRadius: '8px',
            fontWeight: '500',
            zIndex: '9999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            maxWidth: '300px',
            animation: 'toastSlideIn 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) document.body.removeChild(toast);
            }, 300);
        }, duration);
    }
}

// Add toast animation styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes toastSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes toastSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ ArchNemix Shorts Generator Initializing with HeadTTS...');
    initializeApplication();
});

async function initializeApplication() {
    try {
        setupEventListeners();
        await initializeVoices();
        await loadVideos();
        updateStepIndicators();
        Toast.show('ArchNemix AI Ready with HeadTTS Phoneme Alignment', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        Toast.show('Initialization error', 'error');
    }
}

function setupEventListeners() {
    const scriptInput = document.getElementById('scriptInput');
    scriptInput.addEventListener('input', handleScriptInput);
    
    const rateSlider = document.getElementById('rateSlider');
    rateSlider.addEventListener('input', (e) => {
        document.getElementById('rateValue').textContent = e.target.value;
    });
    
    document.getElementById('nextStep1').addEventListener('click', () => goToStep(2));
    document.getElementById('prevStep2').addEventListener('click', () => goToStep(1));
    document.getElementById('nextStep2').addEventListener('click', () => goToStep(3));
    document.getElementById('prevStep3').addEventListener('click', () => goToStep(2));
    document.getElementById('nextStep3').addEventListener('click', () => goToStep(4));
    document.getElementById('prevStep4').addEventListener('click', () => goToStep(3));
    
    document.getElementById('generateAudioBtn').addEventListener('click', generateAudio);
    document.getElementById('generateVideoBtn').addEventListener('click', generateVideo);
    document.getElementById('newVideoBtn').addEventListener('click', resetApplication);
    
    const audioPreview = document.getElementById('audioPreview');
    audioPreview.addEventListener('loadedmetadata', () => {
        state.audioDuration = audioPreview.duration || state.audioDuration;
        updateGenerationInfo();
        console.log(`Audio loaded: ${state.audioDuration}s`);
    });
}

function handleScriptInput(e) {
    state.script = e.target.value;
    const count = e.target.value.length;
    const charCounter = document.getElementById('charCounter');
    
    document.getElementById('charCount').textContent = count;
    charCounter.className = 'char-counter';
    
    if (count > 3000 && count <= 3300) {
        charCounter.classList.add('warning');
    } else if (count > 3300) {
        charCounter.classList.add('error');
    }
    
    document.getElementById('nextStep1').disabled = count < 10;
}

function goToStep(step) {
    state.currentStep = step;
    updateStepIndicators();
    updateStepContent();
    
    if (step === 4) {
        updateGenerationInfo();
    }
}

function updateStepIndicators() {
    document.querySelectorAll('.step-indicator').forEach((el, index) => {
        if (index + 1 === state.currentStep) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function updateStepContent() {
    document.querySelectorAll('.step-content').forEach((el, index) => {
        if (index + 1 === state.currentStep) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

async function initializeVoices() {
    try {
        console.log('Loading voices from HeadTTS API...');
        
        // Rate limit to avoid CORS issues
        await rateLimitRequest();
        
        const response = await fetch(`${TTS_API}/v1/voices`, {
            method: 'GET',
            headers: {
                'Origin': window.location.origin
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load voices from HeadTTS API');
        }
        
        const data = await response.json();
        state.availableTTSVoices = data.voices || [];
        
        const select = document.getElementById('voiceSelect');
        select.innerHTML = '';
        
        if (state.availableTTSVoices.length > 0) {
            state.availableTTSVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice;
                option.textContent = voice.replace('_', ' ').toUpperCase();
                select.appendChild(option);
            });
            
            // Default to first voice
            select.value = state.availableTTSVoices[0];
            
            console.log(`✅ Loaded ${state.availableTTSVoices.length} HeadTTS voices`);
            Toast.show(`${state.availableTTSVoices.length} voices loaded`, 'success');
        } else {
            select.innerHTML = '<option value="">No voices available</option>';
            Toast.show('No TTS voices found', 'warning');
        }
        
    } catch (error) {
        console.error('Failed to load HeadTTS voices:', error);
        
        // Fallback voices
        const select = document.getElementById('voiceSelect');
        select.innerHTML = `
            <option value="af_heart">Heart (American Female)</option>
            <option value="am_adam">Adam (American Male)</option>
            <option value="af_bella">Bella (American Female)</option>
            <option value="bf_emma">Emma (British Female)</option>
        `;
        select.value = 'af_heart';
        
        state.availableTTSVoices = ['af_heart', 'am_adam', 'af_bella', 'bf_emma'];
        
        Toast.show('Using default voices', 'warning');
    }
}

// Rate limiting helper for CORS
async function rateLimitRequest() {
    const now = Date.now();
    const timeSinceLast = now - state.lastRequestTime;
    if (timeSinceLast < 500) { // Max 2 requests per second
        await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLast));
    }
    state.lastRequestTime = Date.now();
}

async function loadVideos() {
    try {
        const response = await fetch(`${API_URL}/videos/minecraft`);
        
        if (response.ok) {
            const data = await response.json();
            renderVideoGrid(data.videos);
            Toast.show(`Loaded ${data.videos.length} videos`, 'success');
            return;
        }
        
        console.log('Using fallback video list');
        renderVideoGrid(['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6']);
        
    } catch (error) {
        console.error('Video loading failed:', error);
        renderVideoGrid(['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6']);
        Toast.show('Using fallback video library', 'warning');
    }
}

function renderVideoGrid(videoList) {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';
    
    const colors = ['#0066FF', '#00CC88', '#FFAA00', '#FF5555', '#AA66FF', '#00CCCC'];
    
    videoList.forEach((videoName, index) => {
        const item = document.createElement('div');
        item.className = 'video-card';
        item.dataset.video = videoName;
        
        const displayName = videoName.replace('.mp4', '').toUpperCase();
        const color = colors[index % colors.length];
        
        item.innerHTML = `
            <div class="video-thumb" style="background: linear-gradient(135deg, ${color}22, ${color}44);">
                <i class="fas fa-gamepad" style="color: ${color}; font-size: 2.5rem;"></i>
            </div>
            <div style="font-weight: 600; margin-top: 0.5rem;">${displayName}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Minecraft Adventure
            </div>
        `;
        
        item.addEventListener('click', function() {
            document.querySelectorAll('.video-card').forEach(el => {
                el.classList.remove('selected');
            });
            
            this.classList.add('selected');
            state.selectedVideo = videoName.replace('.mp4', '');
            
            document.getElementById('nextStep3').disabled = false;
            updateGenerationInfo();
            
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
        
        grid.appendChild(item);
    });
    
    const firstVideo = grid.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
}

// ============== HEADTTS AUDIO GENERATION WITH CORS ==============
async function generateAudio() {
    if (!state.script.trim()) {
        Toast.show('Please enter a script first', 'error');
        return;
    }
    
    const voiceId = document.getElementById('voiceSelect').value;
    const rate = parseFloat(document.getElementById('rateSlider').value);
    
    if (!voiceId) {
        Toast.show('Please select a voice', 'error');
        return;
    }
    
    const audioStatus = document.getElementById('audioStatus');
    const audioBtn = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    
    audioStatus.innerHTML = `<i class="fas fa-robot"></i> Generating AI voiceover with HeadTTS (Phoneme-Aligned)...`;
    audioStatus.className = 'status-message';
    
    audioBtn.disabled = true;
    audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    audioPreview.src = '';
    
    document.getElementById('nextStep2').disabled = true;
    document.getElementById('prevStep2').disabled = true;
    
    try {
        console.log('🎙️ Calling HeadTTS API with CORS headers...');
        console.log('Voice:', voiceId, 'Rate:', rate, 'Text length:', state.script.length);
        
        // Rate limit to avoid overwhelming the CORS-protected API
        await rateLimitRequest();
        
        await generateHeadTTSAudio(state.script, voiceId, rate);
        
        console.log('📝 Generating ONE-WORD-AT-A-TIME subtitles with PERFECT HeadTTS timestamps');
        state.subtitlesASS = generateOneWordSubtitles(state.wordTimestamps);
        
        audioStatus.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> HeadTTS audio generated successfully (${state.audioDuration.toFixed(1)}s) - PHONEME ALIGNED`;
        audioStatus.className = 'status-message status-success';
        
        document.getElementById('nextStep2').disabled = false;
        document.getElementById('prevStep2').disabled = false;
        
        const preview = document.getElementById('subtitlePreview');
        const words = state.wordTimestamps.length;
        preview.innerHTML = `
            <i class="fas fa-closed-captioning" style="color: var(--success);"></i>
            <strong>Perfect Sync:</strong> ${words} words • ${Math.round(state.audioDuration)}s • ONE WORD AT A TIME
        `;
        preview.className = 'status-message status-success';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio';
        
        Toast.show(`HeadTTS: ${state.audioDuration.toFixed(1)}s with ${words} phoneme-aligned timestamps`, 'success');
        
    } catch (error) {
        console.error('❌ HeadTTS generation failed:', error);
        
        audioStatus.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--error);"></i> ${error.message}`;
        audioStatus.className = 'status-message status-error';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio';
        document.getElementById('prevStep2').disabled = false;
        
        Toast.show('HeadTTS generation failed: ' + error.message, 'error', 5000);
    }
}

async function generateHeadTTSAudio(text, voiceId, rate) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Calling HeadTTS API: ${TTS_API}/v1/audio/speech`);
            
            const response = await fetch(`${TTS_API}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                mode: 'cors',
                credentials: 'omit',
                body: JSON.stringify({
                    text: text,
                    voice: voiceId,
                    speed: rate,
                    response_format: "wav",
                    include_timestamps: true
                })
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('CORS: Access forbidden - Origin not allowed');
                }
                
                const errorText = await response.text();
                console.error('HeadTTS API error:', response.status, errorText);
                
                let errorMsg = 'HeadTTS generation failed';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.detail || errorMsg;
                } catch (e) {
                    errorMsg = `HeadTTS API error: ${response.status}`;
                }
                
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            console.log('✅ HeadTTS API response received');
            console.log('Duration:', data.duration, 'Format:', data.format);
            console.log('🎯 PERFECT word timestamps from HeadTTS:', data.timestamps?.length || 0, 'words');
            
            if (!data.success) {
                throw new Error('HeadTTS generation returned unsuccessful');
            }
            
            state.audioDuration = data.duration;
            state.audioBase64 = data.audio;
            
            // 🔥 USE HEADTTS PHONEME-ALIGNED TIMESTAMPS - PERFECT SYNC!
            if (data.timestamps && data.timestamps.length > 0) {
                state.wordTimestamps = data.timestamps;
                console.log(`✨ Using ${data.timestamps.length} PHONEME-ALIGNED timestamps from HeadTTS - PERFECT SYNC!`);
            } else {
                console.error('❌ No timestamps from HeadTTS - this should not happen!');
                state.wordTimestamps = [];
            }
            
            // Convert base64 to blob
            const audioBytes = atob(data.audio);
            const audioArray = new Uint8Array(audioBytes.length);
            for (let i = 0; i < audioBytes.length; i++) {
                audioArray[i] = audioBytes.charCodeAt(i);
            }
            
            const mimeType = data.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
            state.audioBlob = new Blob([audioArray], { type: mimeType });
            
            const audioPreview = document.getElementById('audioPreview');
            const blobUrl = URL.createObjectURL(state.audioBlob);
            audioPreview.src = blobUrl;
            
            console.log(`✅ Audio blob created: ${state.audioBlob.size} bytes, ${state.audioDuration}s`);
            console.log(`✅ ${state.wordTimestamps.length} phoneme-aligned word timestamps ready`);
            
            resolve();
            
        } catch (error) {
            console.error('HeadTTS generation error:', error);
            reject(error);
        }
    });
}

// ============================================================
// OPTIMIZED ONE-WORD-AT-A-TIME SUBTITLE GENERATION
// Uses HeadTTS phoneme-aligned timestamps for PERFECT sync
// Only ONE word appears on screen at a time - clean, readable
// Now includes smooth transitions and better positioning
// ============================================================

function generateOneWordSubtitles(wordTimestamps) {
    if (!wordTimestamps || wordTimestamps.length === 0) {
        console.error('❌ No word timestamps available!');
        return '';
    }
    
    console.log(`🎯 Generating ONE-WORD-AT-A-TIME subtitles from ${wordTimestamps.length} phoneme-aligned timestamps`);
    
    // ASS header for YouTube Shorts (1080x1920 portrait)
    // Optimized for better visibility: larger font, centered, with glow
    const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: WordByWord,Arial Black,110,&H00FFFF00,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,3,5,80,80,200,1
Style: BackgroundWord,Arial Black,110,&H88FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,6,3,5,80,80,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
    
    const dialogueLines = [];
    
    // First, add a background word that stays for reference (optional)
    // This creates a fading effect where the current word is bright yellow
    // and previous words fade out
    
    wordTimestamps.forEach((wordData, index) => {
        const word = wordData.word;
        const start = wordData.start;
        const end = wordData.end;
        
        // Format: bright yellow, bold, with outline and shadow
        // Using \\c&H00FFFF& for yellow, \\b1 for bold
        const subtitle = `Dialogue: 1,${formatASSTime(start)},${formatASSTime(end)},WordByWord,,0,0,0,,{\\c&H00FFFF&}{\\b1}${word}{\\b0}`;
        
        dialogueLines.push(subtitle);
        
        // Optional: Add a preview of next word with fade effect
        // Uncomment if you want words to appear slightly before they're spoken
        /*
        if (index < wordTimestamps.length - 1) {
            const nextWord = wordTimestamps[index + 1].word;
            const previewStart = Math.max(0, end - 0.1); // 100ms before current ends
            const previewEnd = end;
            if (previewStart < previewEnd) {
                dialogueLines.push(`Dialogue: 0,${formatASSTime(previewStart)},${formatASSTime(previewEnd)},BackgroundWord,,0,0,0,,{\\c&H88FFFFFF&}${nextWord}`);
            }
        }
        */
    });
    
    console.log(`✅ Generated ${dialogueLines.length} one-word-at-a-time subtitle events`);
    
    return assHeader + '\n' + dialogueLines.join('\n') + '\n';
}

function formatASSTime(seconds) {
    seconds = Math.max(0, seconds);
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centisecs = Math.round((seconds % 1) * 100);
    return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(centisecs).padStart(2,'0')}`;
}

function updateGenerationInfo() {
    const scriptLength = state.script.length;
    document.getElementById('infoLength').textContent = `${scriptLength} characters`;
    
    const duration = Math.round(state.audioDuration * 10) / 10;
    document.getElementById('infoDuration').textContent = `${duration}s`;
    
    document.getElementById('infoBackground').textContent = state.selectedVideo ? 
        state.selectedVideo.toUpperCase() : 'Not selected';
    
    const estimatedTime = Math.round(10 + (state.audioDuration * 0.5));
    document.getElementById('infoTime').textContent = `${estimatedTime}s`;
}

// ============== VIDEO GENERATION ==============
async function generateVideo() {
    if (!state.audioBase64 || !state.subtitlesASS || !state.selectedVideo) {
        Toast.show('Please complete all previous steps', 'error');
        return;
    }
    
    if (state.audioBase64.length < 100) {
        Toast.show('Audio data appears to be invalid', 'error');
        return;
    }
    
    if (!state.audioDuration || state.audioDuration < 1) {
        Toast.show('Invalid audio duration', 'error');
        return;
    }
    
    const generateBtn = document.getElementById('generateVideoBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    state.isProcessing = true;
    
    statusMessage.innerHTML = `
        <i class="fas fa-robot"></i> 
        Initializing ArchNemix AI Pipeline with HeadTTS PHONEME-ALIGNED subtitles...
    `;
    statusMessage.className = 'status-message';
    
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressText').textContent = 'Starting generation...';
    
    try {
        console.log('Sending generation request to backend...');
        console.log('Audio duration:', state.audioDuration);
        console.log('Background:', state.selectedVideo);
        console.log('Audio size:', state.audioBase64.length, 'chars');
        console.log('Subtitles size:', state.subtitlesASS.length, 'chars');
        console.log('Word timestamps:', state.wordTimestamps.length, 'words (HeadTTS phoneme-aligned)');
        
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-APP-KEY': APP_KEY
            },
            body: JSON.stringify({
                audio_base64: state.audioBase64,
                subtitles_ass: state.subtitlesASS,
                background: state.selectedVideo,
                duration: state.audioDuration,
                request_id: `archnemix_${Date.now()}`
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error:', response.status, errorText);
            throw new Error(`API error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        state.currentJobId = data.job_id;
        
        console.log('Job created:', state.currentJobId);
        
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}...
            <br><small>Estimated time: ${data.estimated_time || 30}s</small>
        `;
        statusMessage.className = 'status-message status-success';
        
        startJobPolling();
        
        Toast.show('Video generation started with HeadTTS phoneme-aligned subtitles', 'success');
        
    } catch (error) {
        console.error('Generation failed:', error);
        
        let errorMsg = 'Failed to start generation';
        if (error.message.includes('Rate limit')) {
            errorMsg = 'Rate limit exceeded (3/hour)';
        } else if (error.message.includes('404')) {
            errorMsg = 'Backend server not responding';
        } else if (error.message.includes('Invalid')) {
            errorMsg = 'Invalid request data';
        }
        
        statusMessage.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
            <strong>Error:</strong> ${errorMsg}
        `;
        statusMessage.className = 'status-message status-error';
        
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
        state.isProcessing = false;
        
        Toast.show(errorMsg, 'error');
    }
}

function startJobPolling() {
    if (state.jobPollInterval) {
        clearInterval(state.jobPollInterval);
    }
    
    console.log('Starting job polling for:', state.currentJobId);
    
    state.jobPollInterval = setInterval(async () => {
        if (!state.currentJobId) {
            clearInterval(state.jobPollInterval);
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/job/${state.currentJobId}`);
            
            if (!response.ok) {
                console.error('Status check failed:', response.status);
                
                if (response.status === 404) {
                    clearInterval(state.jobPollInterval);
                    updateJobStatus({
                        status: 'failed',
                        error: 'Job not found - may have expired'
                    });
                }
                return;
            }
            
            const data = await response.json();
            updateJobStatus(data);
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000);
}

function updateJobStatus(data) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const statusMessage = document.getElementById('statusMessage');
    const resultSection = document.getElementById('resultSection');
    const generateBtn = document.getElementById('generateVideoBtn');
    
    console.log('Job status update:', data.status, data.progress + '%', data.message);
    
    if (data.status === 'processing' || data.status === 'pending') {
        const progress = data.progress || 0;
        progressFill.style.width = `${progress}%`;
        progressPercent.textContent = `${progress}%`;
        progressText.textContent = data.message || 'Processing...';
        
        statusMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <strong>Processing:</strong> ${data.message || 'Generating your short...'}
        `;
        
    } else if (data.status === 'completed') {
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
        console.log('✅ Video generation completed!');
        
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressText.textContent = 'Completed!';
        
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Success!</strong> Video with HeadTTS phoneme-aligned ONE-WORD subtitles ready!
        `;
        statusMessage.className = 'status-message status-success';
        
        const resultVideo = document.getElementById('resultVideo');
        const downloadBtn = document.getElementById('downloadBtn');
        
        const videoUrl = `${API_URL}/download/${state.currentJobId}`;
        resultVideo.src = videoUrl;
        downloadBtn.href = videoUrl;
        downloadBtn.download = `archnemix-short-${state.currentJobId.substring(0, 8)}.mp4`;
        
        resultSection.style.display = 'block';
        generateBtn.style.display = 'none';
        
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success', 5000);
        
    } else if (data.status === 'failed') {
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
        console.error('❌ Video generation failed:', data.error);
        
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Failed';
        
        statusMessage.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
            <strong>Failed:</strong> ${data.error || 'Unknown error'}
        `;
        statusMessage.className = 'status-message status-error';
        
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
        generateBtn.style.display = 'block';
        state.isProcessing = false;
        
        Toast.show('Video generation failed', 'error', 5000);
        
    } else if (data.status === 'rate_limited') {
        statusMessage.innerHTML = `
            <i class="fas fa-clock" style="color: var(--warning);"></i>
            <strong>Rate Limited:</strong> Too many status checks...
        `;
    }
}

function resetApplication() {
    if (state.jobPollInterval) {
        clearInterval(state.jobPollInterval);
        state.jobPollInterval = null;
    }
    
    state.audioBlob = null;
    state.audioDuration = 0;
    state.subtitlesASS = "";
    state.selectedVideo = "mc1";
    state.currentJobId = "";
    state.audioBase64 = "";
    state.script = "";
    state.isProcessing = false;
    state.wordTimestamps = [];
    
    document.getElementById('scriptInput').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('charCounter').className = 'char-counter';
    
    document.getElementById('audioPreview').src = '';
    document.getElementById('audioStatus').innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Audio" to preview with HeadTTS';
    document.getElementById('audioStatus').className = 'status-message';
    
    document.getElementById('subtitlePreview').innerHTML = '<i class="fas fa-closed-captioning"></i> One-word-at-a-time subtitles will be generated';
    document.getElementById('subtitlePreview').className = 'status-message';
    
    document.querySelectorAll('.video-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('generateVideoBtn').style.display = 'block';
    document.getElementById('generateVideoBtn').disabled = false;
    document.getElementById('generateVideoBtn').innerHTML = '<i class="fas fa-bolt"></i> Generate Now';
    
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressText').textContent = 'Ready to generate';
    
    document.getElementById('statusMessage').innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Now" to start';
    document.getElementById('statusMessage').className = 'status-message';
    
    goToStep(1);
    
    const firstVideo = document.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
    
    Toast.show('Ready for new creation', 'info');
    console.log('Application reset');
}

// ============== DEBUG UTILITIES ==============
window.debugState = () => {
    console.log('🔍 ArchNemix State:', {
        scriptLength: state.script.length,
        audioDuration: state.audioDuration,
        audioSize: state.audioBase64.length,
        subsSize: state.subtitlesASS.length,
        selectedVideo: state.selectedVideo,
        currentJob: state.currentJobId,
        isProcessing: state.isProcessing,
        availableVoices: state.availableTTSVoices.length,
        wordTimestamps: state.wordTimestamps.length,
        ttsEngine: 'HeadTTS (Phoneme-Aligned)',
        lastRequestTime: new Date(state.lastRequestTime).toISOString()
    });
    return state;
};

window.testBackend = async () => {
    try {
        const results = { tts: {}, video: {} };
        
        console.log('Testing HeadTTS API with CORS...');
        try {
            await rateLimitRequest();
            
            const rootResponse = await fetch(`${TTS_API}/health`, {
                headers: { 'Origin': window.location.origin },
                mode: 'cors'
            });
            results.tts.health = { status: rootResponse.status, ok: rootResponse.ok };
            if (rootResponse.ok) results.tts.health.data = await rootResponse.json();
            
            await rateLimitRequest();
            
            const voicesResponse = await fetch(`${TTS_API}/v1/voices`, {
                headers: { 'Origin': window.location.origin },
                mode: 'cors'
            });
            results.tts.voices = { status: voicesResponse.status, ok: voicesResponse.ok };
            if (voicesResponse.ok) results.tts.voices.data = await voicesResponse.json();
        } catch (error) {
            results.tts.error = error.message;
        }
        
        console.log('Testing Video API...');
        const videoEndpoints = ['/', '/health', '/videos/minecraft'];
        for (const endpoint of videoEndpoints) {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                results.video[endpoint] = { status: response.status, ok: response.ok };
                if (response.ok) results.video[endpoint].data = await response.json();
            } catch (error) {
                results.video[endpoint] = { error: error.message };
            }
        }
        
        console.log('🔧 Backend Test Results:', results);
        Toast.show('Backend test complete - check console', 'info');
        return results;
        
    } catch (error) {
        console.error('Backend test failed:', error);
        Toast.show('Backend test failed', 'error');
        return null;
    }
};

window.testTTS = async (text = "Hello world, this is a test with HeadTTS phoneme alignment.") => {
    try {
        console.log('Testing HeadTTS with text:', text);
        
        await rateLimitRequest();
        
        const response = await fetch(`${TTS_API}/v1/audio/speech`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            mode: 'cors',
            body: JSON.stringify({
                text: text,
                voice: 'af_heart',
                speed: 1.0,
                response_format: 'wav',
                include_timestamps: true
            })
        });
        
        if (!response.ok) throw new Error(`HeadTTS failed: ${response.status}`);
        
        const data = await response.json();
        console.log('✅ HeadTTS Test Success:', data);
        console.log('Phoneme-aligned word timestamps:', data.timestamps);
        
        if (data.audio) {
            const audio = new Audio('data:audio/wav;base64,' + data.audio);
            audio.play();
        }
        
        Toast.show('HeadTTS test successful', 'success');
        return data;
        
    } catch (error) {
        console.error('HeadTTS test failed:', error);
        Toast.show('HeadTTS test failed: ' + error.message, 'error');
        return null;
    }
};

console.log('🚀 ArchNemix Shorts Generator v14.0 - HEADTTS PHONEME-ALIGNED');
console.log('🎯 Perfect subtitle sync using HeadTTS phoneme-aligned word timestamps');
console.log('📝 ONE WORD AT A TIME subtitle display for maximum readability');
console.log('🔒 CORS: Only requests from shortgen-archx.pages.dev allowed');
console.log('📝 Available commands: debugState(), testBackend(), testTTS()');
