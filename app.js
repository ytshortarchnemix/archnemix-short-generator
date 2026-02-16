// ArchNemix Shorts Generator - Complete with Kokoro-82M + ArchxAUDSBT Alignment
// ============================================================================

// ========== CONFIGURATION ==========
const API_URL = "https://ytshortmakerarchx-ytshrt-archx-mc-1.hf.space";
const TTS_API = "https://ytshortmakerarchx-headtts-service.hf.space"; // Kokoro-82M API
const ALIGNER_API = "https://ytshortmakerarchx-archxaudsbt.hf.space"; // Alignment service
const APP_KEY = "archx_3f9d15f52n48d41h5fj8a7e2b_private";

// ========== APPLICATION STATE ==========
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
    wordTimestamps: [],  // Raw timestamps from Kokoro-82M
    alignmentJobId: "",  // For polling alignment service
    alignmentStatus: "pending"
};

// ========== TOAST NOTIFICATION SYSTEM ==========
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
            warning: '#FFAA00',
            info: '#0066FF'
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

// ========== MAIN INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ ArchNemix Shorts Generator with ArchxAUDSBT Alignment');
    console.log('🎯 TTS API:', TTS_API);
    console.log('🔧 Aligner API:', ALIGNER_API);
    initializeApplication();
});

async function initializeApplication() {
    try {
        setupEventListeners();
        await initializeVoices();
        await loadVideos();
        updateStepIndicators();
        Toast.show('Ready with ArchxAUDSBT alignment', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        Toast.show('Initialization error', 'error');
    }
}

function setupEventListeners() {
    // Script input
    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput) {
        scriptInput.addEventListener('input', handleScriptInput);
    }
    
    // Rate slider
    const rateSlider = document.getElementById('rateSlider');
    if (rateSlider) {
        rateSlider.addEventListener('input', (e) => {
            document.getElementById('rateValue').textContent = e.target.value;
        });
    }
    
    // Navigation buttons
    const nextStep1 = document.getElementById('nextStep1');
    if (nextStep1) nextStep1.addEventListener('click', () => goToStep(2));
    
    const prevStep2 = document.getElementById('prevStep2');
    if (prevStep2) prevStep2.addEventListener('click', () => goToStep(1));
    
    const nextStep2 = document.getElementById('nextStep2');
    if (nextStep2) nextStep2.addEventListener('click', () => goToStep(3));
    
    const prevStep3 = document.getElementById('prevStep3');
    if (prevStep3) prevStep3.addEventListener('click', () => goToStep(2));
    
    const nextStep3 = document.getElementById('nextStep3');
    if (nextStep3) nextStep3.addEventListener('click', () => goToStep(4));
    
    const prevStep4 = document.getElementById('prevStep4');
    if (prevStep4) prevStep4.addEventListener('click', () => goToStep(3));
    
    // Action buttons
    const generateAudioBtn = document.getElementById('generateAudioBtn');
    if (generateAudioBtn) generateAudioBtn.addEventListener('click', generateAudio);
    
    const generateVideoBtn = document.getElementById('generateVideoBtn');
    if (generateVideoBtn) generateVideoBtn.addEventListener('click', generateVideo);
    
    const newVideoBtn = document.getElementById('newVideoBtn');
    if (newVideoBtn) newVideoBtn.addEventListener('click', resetApplication);
    
    // Audio preview
    const audioPreview = document.getElementById('audioPreview');
    if (audioPreview) {
        audioPreview.addEventListener('loadedmetadata', () => {
            state.audioDuration = audioPreview.duration || state.audioDuration;
            updateGenerationInfo();
            console.log(`Audio loaded: ${state.audioDuration}s`);
        });
    }
}

function handleScriptInput(e) {
    state.script = e.target.value;
    const count = e.target.value.length;
    const charCounter = document.getElementById('charCounter');
    const charCount = document.getElementById('charCount');
    const nextBtn = document.getElementById('nextStep1');
    
    if (charCount) charCount.textContent = count;
    if (charCounter) charCounter.className = 'char-counter';
    
    if (count > 3000 && count <= 3300) {
        if (charCounter) charCounter.classList.add('warning');
    } else if (count > 3300) {
        if (charCounter) charCounter.classList.add('error');
    }
    
    if (nextBtn) nextBtn.disabled = count < 10;
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

// ========== VOICE INITIALIZATION ==========
async function initializeVoices() {
    try {
        console.log('Loading voices from Kokoro-82M API...');
        
        const response = await fetch(`${TTS_API}/voices`, {
            method: 'GET',
            headers: {
                'Origin': window.location.origin
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load voices');
        }
        
        const data = await response.json();
        state.availableTTSVoices = data.voices || [];
        
        const select = document.getElementById('voiceSelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        if (state.availableTTSVoices.length > 0) {
            state.availableTTSVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.id;
                option.textContent = `${voice.name} [${voice.quality.toUpperCase()}]`;
                select.appendChild(option);
            });
            
            // Default to male_high if available
            if (state.availableTTSVoices.some(v => v.id === 'male_high')) {
                select.value = 'male_high';
            }
            
            console.log(`✅ Loaded ${state.availableTTSVoices.length} Kokoro-82M voices`);
            Toast.show(`${state.availableTTSVoices.length} voices loaded`, 'success');
        } else {
            // Fallback voices
            select.innerHTML = `
                <option value="male_high">Michael (US Male) - High Quality</option>
                <option value="male_medium">Adam (US Male) - Clear</option>
                <option value="female_high">Sarah (US Female) - High Quality</option>
                <option value="female_medium">Sky (US Female) - Natural</option>
            `;
            select.value = 'male_high';
            
            state.availableTTSVoices = [
                { id: 'male_high', name: 'Michael (US Male) - High Quality', quality: 'high' },
                { id: 'male_medium', name: 'Adam (US Male) - Clear', quality: 'medium' },
                { id: 'female_high', name: 'Sarah (US Female) - High Quality', quality: 'high' },
                { id: 'female_medium', name: 'Sky (US Female) - Natural', quality: 'medium' }
            ];
            
            Toast.show('Using default voices', 'warning');
        }
        
    } catch (error) {
        console.error('Failed to load Kokoro-82M voices:', error);
        Toast.show('Voice loading failed, using defaults', 'warning');
    }
}

// ========== VIDEO LOADING ==========
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
    if (!grid) return;
    
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
            
            const nextBtn = document.getElementById('nextStep3');
            if (nextBtn) nextBtn.disabled = false;
            
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

// ========== FORCED ALIGNMENT SERVICE (ArchxAUDSBT) ==========
async function alignSubtitlesWithService(audioBase64, text, timestamps) {
    /**
     * Send audio and timestamps to ArchxAUDSBT alignment service
     * Returns PERFECTLY aligned ASS subtitles
     */
    
    const statusMessage = document.getElementById('audioStatus');
    
    try {
        if (statusMessage) {
            statusMessage.innerHTML = `<i class="fas fa-robot"></i> Sending to ArchxAUDSBT alignment service...`;
        }
        
        console.log('🔧 Sending to alignment service:', ALIGNER_API);
        console.log('Audio size:', audioBase64.length, 'chars');
        console.log('Text length:', text.length);
        console.log('Initial timestamps:', timestamps.length, 'words');
        
        // Call alignment service
        const response = await fetch(`${ALIGNER_API}/align`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            mode: 'cors',
            body: JSON.stringify({
                audio: audioBase64,
                text: text,
                initial_timestamps: timestamps,
                output_format: 'ass',
                language: 'en',
                sample_rate: 24000
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Alignment API error:', response.status, errorText);
            throw new Error(`Alignment failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Alignment service response:', data);
        
        // Handle different response formats
        if (data.status === 'processing' && data.job_id) {
            // Async job - need to poll
            state.alignmentJobId = data.job_id;
            if (statusMessage) {
                statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Alignment in progress...`;
            }
            return await pollAlignmentResult(data.job_id);
            
        } else if (data.ass_subtitles || data.subtitles || data.result) {
            // Sync response with subtitles
            console.log('✅ Alignment completed synchronously!');
            return data.ass_subtitles || data.subtitles || data.result;
            
        } else if (data.error) {
            throw new Error(data.error);
            
        } else {
            console.warn('Unexpected alignment response:', data);
            throw new Error('Unexpected alignment service response');
        }
        
    } catch (error) {
        console.error('❌ Alignment failed:', error);
        throw error;
    }
}

async function pollAlignmentResult(jobId) {
    /** Poll ArchxAUDSBT service for result */
    
    return new Promise((resolve, reject) => {
        const maxAttempts = 60;
        let attempts = 0;
        
        const interval = setInterval(async () => {
            try {
                attempts++;
                
                const response = await fetch(`${ALIGNER_API}/job/${jobId}`, {
                    headers: {
                        'Origin': window.location.origin
                    },
                    mode: 'cors'
                });
                
                if (!response.ok) {
                    if (response.status === 404 && attempts < maxAttempts) {
                        // Job not found yet, continue polling
                        return;
                    }
                    clearInterval(interval);
                    reject(new Error(`Alignment status check failed: ${response.status}`));
                    return;
                }
                
                const data = await response.json();
                
                if (data.status === 'completed' || data.status === 'success') {
                    clearInterval(interval);
                    console.log('✅ Alignment completed!');
                    resolve(data.ass_subtitles || data.subtitles || data.result);
                    
                } else if (data.status === 'failed' || data.status === 'error') {
                    clearInterval(interval);
                    reject(new Error(data.error || 'Alignment failed'));
                    
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error('Alignment timeout'));
                }
                
                // Update progress
                const progress = data.progress || Math.round(attempts/maxAttempts*100);
                const statusMessage = document.getElementById('audioStatus');
                if (statusMessage) {
                    statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Aligning subtitles... ${progress}%`;
                }
                
            } catch (error) {
                console.warn('Polling error (continuing):', error);
            }
        }, 2000);
    });
}

// ========== KOKORO-82M AUDIO GENERATION ==========
async function generateAudio() {
    if (!state.script.trim()) {
        Toast.show('Please enter a script first', 'error');
        return;
    }
    
    const voiceId = document.getElementById('voiceSelect')?.value;
    const rate = parseFloat(document.getElementById('rateSlider')?.value || '1.0');
    
    if (!voiceId) {
        Toast.show('Please select a voice', 'error');
        return;
    }
    
    const audioStatus = document.getElementById('audioStatus');
    const audioBtn = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    const nextBtn = document.getElementById('nextStep2');
    const prevBtn = document.getElementById('prevStep2');
    
    if (audioStatus) {
        audioStatus.innerHTML = `<i class="fas fa-robot"></i> Step 1: Generating audio with Kokoro-82M...`;
        audioStatus.className = 'status-message';
    }
    
    if (audioBtn) {
        audioBtn.disabled = true;
        audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    if (audioPreview) audioPreview.src = '';
    
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;
    
    try {
        console.log('🎙️ Step 1: Calling Kokoro-82M API...');
        
        // Step 1: Generate audio with Kokoro-82M
        await generateKokoroAudio(state.script, voiceId, rate);
        
        // Step 2: Send to ArchxAUDSBT forced alignment service
        if (audioStatus) {
            audioStatus.innerHTML = `<i class="fas fa-robot"></i> Step 2: Sending to ArchxAUDSBT alignment service...`;
        }
        
        try {
            const alignedASS = await alignSubtitlesWithService(
                state.audioBase64,
                state.script,
                state.wordTimestamps
            );
            
            // Step 3: Use the perfectly aligned subtitles
            state.subtitlesASS = alignedASS;
            
            console.log('✅ Forced alignment completed!');
            
            if (audioStatus) {
                audioStatus.innerHTML = `
                    <i class="fas fa-check-circle" style="color: var(--success);"></i> 
                    Audio + Alignment Complete! (${state.audioDuration.toFixed(1)}s)
                `;
                audioStatus.className = 'status-message status-success';
            }
            
            if (nextBtn) nextBtn.disabled = false;
            if (prevBtn) prevBtn.disabled = false;
            
            const preview = document.getElementById('subtitlePreview');
            if (preview) {
                preview.innerHTML = `
                    <i class="fas fa-closed-captioning" style="color: var(--success);"></i>
                    <strong>Perfect Sync:</strong> ${state.wordTimestamps.length} words • Force-aligned by ArchxAUDSBT
                `;
                preview.className = 'status-message status-success';
            }
            
            Toast.show(`ArchxAUDSBT alignment complete - perfect sync!`, 'success');
            
        } catch (alignError) {
            console.error('❌ Alignment failed, using Kokoro timestamps as fallback:', alignError);
            
            // Fallback: Generate ASS from Kokoro timestamps
            state.subtitlesASS = generateFallbackSubtitles(state.wordTimestamps);
            
            if (audioStatus) {
                audioStatus.innerHTML = `
                    <i class="fas fa-exclamation-circle" style="color: var(--warning);"></i> 
                    Alignment service unavailable, using Kokoro timestamps
                `;
                audioStatus.className = 'status-message status-warning';
            }
            
            if (nextBtn) nextBtn.disabled = false;
            if (prevBtn) prevBtn.disabled = false;
            
            Toast.show('Using Kokoro timestamps (alignment failed)', 'warning');
        }
        
        if (audioBtn) {
            audioBtn.disabled = false;
            audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio';
        }
        
    } catch (error) {
        console.error('❌ Generation failed:', error);
        
        if (audioStatus) {
            audioStatus.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--error);"></i> ${error.message}`;
            audioStatus.className = 'status-message status-error';
        }
        
        if (audioBtn) {
            audioBtn.disabled = false;
            audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio';
        }
        
        if (prevBtn) prevBtn.disabled = false;
        
        Toast.show('Failed: ' + error.message, 'error', 5000);
    }
}

async function generateKokoroAudio(text, voiceId, rate) {
    /** Generate audio with Kokoro-82M and get raw timestamps */
    
    console.log(`Calling Kokoro-82M API: ${TTS_API}/tts`);
    
    const response = await fetch(`${TTS_API}/tts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Origin': window.location.origin
        },
        mode: 'cors',
        body: JSON.stringify({
            text: text,
            voice: voiceId,
            rate: rate
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Kokoro-82M failed: ${response.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    console.log('✅ Kokoro-82M response received');
    console.log('Duration:', data.duration);
    console.log('Raw timestamps:', data.word_timestamps?.length, 'words');
    
    // Store everything
    state.wordTimestamps = data.word_timestamps || [];
    state.audioDuration = data.duration;
    state.audioBase64 = data.audio_base64;
    
    // Create audio blob for preview
    const audioBytes = atob(data.audio_base64);
    const audioArray = new Uint8Array(audioBytes.length);
    for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
    }
    
    state.audioBlob = new Blob([audioArray], { type: 'audio/wav' });
    
    const audioPreview = document.getElementById('audioPreview');
    if (audioPreview) {
        const blobUrl = URL.createObjectURL(state.audioBlob);
        audioPreview.src = blobUrl;
    }
    
    return data;
}

// Fallback: Generate ASS from Kokoro timestamps
function generateFallbackSubtitles(wordTimestamps) {
    if (!wordTimestamps || wordTimestamps.length === 0) {
        return '';
    }
    
    const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: KokoroWord,Arial Black,110,&H00FFFF00,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,3,5,80,80,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
    
    const dialogueLines = wordTimestamps.map(wordData => {
        return `Dialogue: 1,${formatASSTime(wordData.start)},${formatASSTime(wordData.end)},KokoroWord,,0,0,0,,{\\c&H00FFFF&}{\\b1}${wordData.word}{\\b0}`;
    });
    
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
    const infoLength = document.getElementById('infoLength');
    const infoDuration = document.getElementById('infoDuration');
    const infoBackground = document.getElementById('infoBackground');
    const infoTime = document.getElementById('infoTime');
    
    if (infoLength) infoLength.textContent = `${scriptLength} characters`;
    
    const duration = Math.round(state.audioDuration * 10) / 10;
    if (infoDuration) infoDuration.textContent = `${duration}s`;
    
    if (infoBackground) {
        infoBackground.textContent = state.selectedVideo ? 
            state.selectedVideo.toUpperCase() : 'Not selected';
    }
    
    const estimatedTime = Math.round(10 + (state.audioDuration * 0.5));
    if (infoTime) infoTime.textContent = `${estimatedTime}s`;
}

// ========== VIDEO GENERATION ==========
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
    
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    state.isProcessing = true;
    
    if (statusMessage) {
        statusMessage.innerHTML = `
            <i class="fas fa-robot"></i> 
            Initializing ArchNemix AI Pipeline with ArchxAUDSBT aligned subtitles...
        `;
        statusMessage.className = 'status-message';
    }
    
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressText) progressText.textContent = 'Starting generation...';
    
    try {
        console.log('Sending generation request to backend...');
        console.log('Audio duration:', state.audioDuration);
        console.log('Background:', state.selectedVideo);
        console.log('Audio size:', state.audioBase64.length, 'chars');
        console.log('Subtitles size:', state.subtitlesASS.length, 'chars');
        console.log('Word timestamps:', state.wordTimestamps.length, 'words');
        
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
        
        if (statusMessage) {
            statusMessage.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--success);"></i>
                <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}...
                <br><small>Estimated time: ${data.estimated_time || 30}s</small>
            `;
            statusMessage.className = 'status-message status-success';
        }
        
        startJobPolling();
        
        Toast.show('Video generation started with ArchxAUDSBT aligned subtitles', 'success');
        
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
        
        if (statusMessage) {
            statusMessage.innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
                <strong>Error:</strong> ${errorMsg}
            `;
            statusMessage.className = 'status-message status-error';
        }
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
        }
        
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
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressPercent) progressPercent.textContent = `${progress}%`;
        if (progressText) progressText.textContent = data.message || 'Processing...';
        
        if (statusMessage) {
            statusMessage.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <strong>Processing:</strong> ${data.message || 'Generating your short...'}
            `;
        }
        
    } else if (data.status === 'completed') {
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
        console.log('✅ Video generation completed!');
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressText) progressText.textContent = 'Completed!';
        
        if (statusMessage) {
            statusMessage.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--success);"></i>
                <strong>Success!</strong> Video with ArchxAUDSBT aligned subtitles ready!
            `;
            statusMessage.className = 'status-message status-success';
        }
        
        const resultVideo = document.getElementById('resultVideo');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (resultVideo) {
            const videoUrl = `${API_URL}/download/${state.currentJobId}`;
            resultVideo.src = videoUrl;
        }
        
        if (downloadBtn) {
            downloadBtn.href = `${API_URL}/download/${state.currentJobId}`;
            downloadBtn.download = `archnemix-short-${state.currentJobId.substring(0, 8)}.mp4`;
        }
        
        if (resultSection) {
            resultSection.style.display = 'block';
        }
        
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }
        
        if (resultSection) {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success', 5000);
        
    } else if (data.status === 'failed') {
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
        console.error('❌ Video generation failed:', data.error);
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressText) progressText.textContent = 'Failed';
        
        if (statusMessage) {
            statusMessage.innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
                <strong>Failed:</strong> ${data.error || 'Unknown error'}
            `;
            statusMessage.className = 'status-message status-error';
        }
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
            generateBtn.style.display = 'block';
        }
        
        state.isProcessing = false;
        
        Toast.show('Video generation failed', 'error', 5000);
    }
}

function resetApplication() {
    if (state.jobPollInterval) {
        clearInterval(state.jobPollInterval);
        state.jobPollInterval = null;
    }
    
    // Reset state
    state.audioBlob = null;
    state.audioDuration = 0;
    state.subtitlesASS = "";
    state.selectedVideo = "mc1";
    state.currentJobId = "";
    state.audioBase64 = "";
    state.script = "";
    state.isProcessing = false;
    state.wordTimestamps = [];
    
    // Reset UI elements
    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput) scriptInput.value = '';
    
    const charCount = document.getElementById('charCount');
    if (charCount) charCount.textContent = '0';
    
    const charCounter = document.getElementById('charCounter');
    if (charCounter) charCounter.className = 'char-counter';
    
    const audioPreview = document.getElementById('audioPreview');
    if (audioPreview) audioPreview.src = '';
    
    const audioStatus = document.getElementById('audioStatus');
    if (audioStatus) {
        audioStatus.innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Audio" to preview with Kokoro-82M';
        audioStatus.className = 'status-message';
    }
    
    const subtitlePreview = document.getElementById('subtitlePreview');
    if (subtitlePreview) {
        subtitlePreview.innerHTML = '<i class="fas fa-closed-captioning"></i> One-word-at-a-time subtitles will be generated';
        subtitlePreview.className = 'status-message';
    }
    
    document.querySelectorAll('.video-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const resultSection = document.getElementById('resultSection');
    if (resultSection) resultSection.style.display = 'none';
    
    const generateBtn = document.getElementById('generateVideoBtn');
    if (generateBtn) {
        generateBtn.style.display = 'block';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate Now';
    }
    
    const progressFill = document.getElementById('progressFill');
    if (progressFill) progressFill.style.width = '0%';
    
    const progressPercent = document.getElementById('progressPercent');
    if (progressPercent) progressPercent.textContent = '0%';
    
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.textContent = 'Ready to generate';
    
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Now" to start';
        statusMessage.className = 'status-message';
    }
    
    goToStep(1);
    
    const firstVideo = document.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
    
    Toast.show('Ready for new creation', 'info');
    console.log('Application reset');
}

// ========== DEBUG UTILITIES ==========
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
        ttsEngine: 'Kokoro-82M',
        aligner: 'ArchxAUDSBT'
    });
    return state;
};

window.testAlignment = async (text = "Hello world, this is a test of the ArchxAUDSBT alignment service.") => {
    try {
        console.log('🧪 Testing Kokoro-82M + ArchxAUDSBT alignment...');
        
        // Step 1: Get audio from Kokoro
        const ttsResponse = await fetch(`${TTS_API}/tts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            mode: 'cors',
            body: JSON.stringify({ 
                text, 
                voice: 'male_high', 
                rate: 1.0 
            })
        });
        
        if (!ttsResponse.ok) {
            throw new Error(`TTS failed: ${ttsResponse.status}`);
        }
        
        const ttsData = await ttsResponse.json();
        console.log('✅ Kokoro audio generated:', ttsData.duration, 's');
        console.log('Timestamps:', ttsData.word_timestamps?.length, 'words');
        
        // Step 2: Send to aligner
        const alignResponse = await fetch(`${ALIGNER_API}/align`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            mode: 'cors',
            body: JSON.stringify({
                audio: ttsData.audio_base64,
                text: text,
                initial_timestamps: ttsData.word_timestamps,
                output_format: 'ass',
                language: 'en'
            })
        });
        
        if (!alignResponse.ok) {
            throw new Error(`Alignment failed: ${alignResponse.status}`);
        }
        
        const alignData = await alignResponse.json();
        console.log('✅ Alignment result:', alignData);
        
        if (alignData.ass_subtitles) {
            console.log('ASS Subtitles preview:', alignData.ass_subtitles.substring(0, 300) + '...');
        }
        
        Toast.show('Alignment test complete - check console', 'success');
        return alignData;
        
    } catch (error) {
        console.error('Test failed:', error);
        Toast.show('Test failed: ' + error.message, 'error');
        return null;
    }
};

window.testTTS = async (text = "Hello world, this is a test of Kokoro-82M.") => {
    try {
        const response = await fetch(`${TTS_API}/tts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            mode: 'cors',
            body: JSON.stringify({ 
                text, 
                voice: 'male_high', 
                rate: 1.0 
            })
        });
        
        const data = await response.json();
        console.log('✅ TTS Test:', data);
        
        // Play audio
        const audio = new Audio('data:audio/wav;base64,' + data.audio_base64);
        audio.play();
        
        return data;
    } catch (error) {
        console.error('TTS test failed:', error);
    }
};

// Log startup
console.log('🚀 ArchNemix Shorts Generator v16.0');
console.log('🎯 TTS: Kokoro-82M');
console.log('🔧 Aligner: ArchxAUDSBT');
console.log('📝 Commands: debugState(), testAlignment(), testTTS()');
