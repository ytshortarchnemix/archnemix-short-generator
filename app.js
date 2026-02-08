// ArchNemix Shorts Generator - Complete Application Logic
// Configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
const API_URL = "https://YTShortMakerArchx-ytshrt_archx_mc_1.hf.space"; // Your HF Space URL
const APP_KEY = "archx_3f9d15f52n48d41h5fj8a7e2b_private"; // Same as in backend secrets

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
    isProcessing: false
};

// Toast Notification System
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
        
        // Auto-remove after duration
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
    console.log('✨ ArchNemix Shorts Generator Initializing...');
    initializeApplication();
});

async function initializeApplication() {
    try {
        setupEventListeners();
        await initializeVoices();
        await loadVideos();
        updateStepIndicators();
        Toast.show('ArchNemix AI Ready', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        Toast.show('Initialization error', 'error');
    }
}

function setupEventListeners() {
    // Script input handling
    const scriptInput = document.getElementById('scriptInput');
    scriptInput.addEventListener('input', handleScriptInput);
    
    // Rate slider
    const rateSlider = document.getElementById('rateSlider');
    rateSlider.addEventListener('input', (e) => {
        document.getElementById('rateValue').textContent = e.target.value;
    });
    
    // Step navigation
    document.getElementById('nextStep1').addEventListener('click', () => goToStep(2));
    document.getElementById('prevStep2').addEventListener('click', () => goToStep(1));
    document.getElementById('nextStep2').addEventListener('click', () => goToStep(3));
    document.getElementById('prevStep3').addEventListener('click', () => goToStep(2));
    document.getElementById('nextStep3').addEventListener('click', () => goToStep(4));
    document.getElementById('prevStep4').addEventListener('click', () => goToStep(3));
    
    // Action buttons
    document.getElementById('generateAudioBtn').addEventListener('click', generateAudio);
    document.getElementById('generateVideoBtn').addEventListener('click', generateVideo);
    document.getElementById('newVideoBtn').addEventListener('click', resetApplication);
    
    // Audio preview events
    const audioPreview = document.getElementById('audioPreview');
    audioPreview.addEventListener('loadedmetadata', () => {
        state.audioDuration = audioPreview.duration || state.audioDuration;
        updateGenerationInfo();
    });
}

function handleScriptInput(e) {
    state.script = e.target.value;
    const count = e.target.value.length;
    const charCounter = document.getElementById('charCounter');
    
    document.getElementById('charCount').textContent = count;
    charCounter.className = 'char-counter';
    
    if (count > 400 && count <= 450) {
        charCounter.classList.add('warning');
    } else if (count > 450) {
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
    if (!('speechSynthesis' in window)) {
        document.getElementById('voiceSelect').innerHTML = 
            '<option value="">Speech synthesis not available</option>';
        Toast.show('Browser TTS not supported', 'warning');
        return;
    }
    
    const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) return;
        
        const select = document.getElementById('voiceSelect');
        select.innerHTML = '<option value="">Select Voice</option>';
        
        // Group voices by language
        const englishVoices = voices.filter(v => v.lang.startsWith('en-'));
        const otherVoices = voices.filter(v => !v.lang.startsWith('en-'));
        
        if (englishVoices.length > 0) {
            englishVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name.replace('Microsoft ', '').replace('Google ', '')} (${voice.lang})`;
                select.appendChild(option);
            });
            
            // Auto-select first English voice
            select.value = englishVoices[0].name;
        }
        
        state.voices = voices;
    };
    
    // Load voices
    loadVoices();
    
    // Some browsers load voices async
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
}

async function loadVideos() {
    try {
        // Try backend endpoint first
        const response = await fetch(`${API_URL}/videos/minecraft`);
        
        if (response.ok) {
            const data = await response.json();
            renderVideoGrid(data.videos);
            Toast.show(`Loaded ${data.videos.length} videos`, 'success');
            return;
        }
        
        // Fallback to hardcoded list
        console.log('Using fallback video list');
        renderVideoGrid(['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6']);
        
    } catch (error) {
        console.error('Video loading failed:', error);
        // Use hardcoded fallback
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
        
        // Clean video name for display
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
            // Deselect all
            document.querySelectorAll('.video-card').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Select this one
            this.classList.add('selected');
            state.selectedVideo = videoName.replace('.mp4', '');
            
            // Enable next button
            document.getElementById('nextStep3').disabled = false;
            updateGenerationInfo();
            
            // Visual feedback
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
        
        grid.appendChild(item);
    });
    
    // Auto-select first video
    const firstVideo = grid.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
}

async function generateAudio() {
    if (!state.script.trim()) {
        Toast.show('Please enter a script first', 'error');
        return;
    }
    
    const voiceName = document.getElementById('voiceSelect').value;
    const rate = parseFloat(document.getElementById('rateSlider').value);
    
    // Update UI state
    const audioStatus = document.getElementById('audioStatus');
    const audioBtn = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    
    audioStatus.innerHTML = `<i class="fas fa-robot"></i> Generating AI voiceover...`;
    audioStatus.className = 'status-message';
    
    audioBtn.disabled = true;
    audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    audioPreview.src = '';
    
    // Disable navigation
    document.getElementById('nextStep2').disabled = true;
    document.getElementById('prevStep2').disabled = true;
    
    try {
        // Generate audio (simulated for now - replace with real TTS)
        await generateSimulatedAudio(state.script, voiceName, rate);
        
        // Generate subtitles
        state.subtitlesASS = generateSubtitles(state.script, state.audioDuration);
        
        // Update UI
        audioStatus.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Audio generated successfully`;
        audioStatus.className = 'status-message status-success';
        
        document.getElementById('nextStep2').disabled = false;
        document.getElementById('prevStep2').disabled = false;
        
        // Update subtitle preview
        const preview = document.getElementById('subtitlePreview');
        const words = state.script.split(/\s+/).length;
        preview.innerHTML = `
            <i class="fas fa-closed-captioning" style="color: var(--success);"></i>
            <strong>Subtitles Ready:</strong> ${words} words • ${Math.round(state.audioDuration)}s
        `;
        preview.className = 'status-message status-success';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio';
        
        Toast.show('Audio generated successfully', 'success');
        
    } catch (error) {
        console.error('Audio generation failed:', error);
        
        audioStatus.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--error);"></i> ${error.message}`;
        audioStatus.className = 'status-message status-error';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio';
        document.getElementById('prevStep2').disabled = false;
        
        Toast.show('Audio generation failed', 'error');
    }
}

async function generateSimulatedAudio(text, voiceName, rate) {
    return new Promise((resolve) => {
        // Simulate processing time
        setTimeout(() => {
            // Calculate duration based on word count (average 2.5 words/second)
            const words = text.split(/\s+/).length;
            state.audioDuration = Math.max(3, Math.min(180, words / 2.5));
            
            // Create simulated audio blob
            createMockAudioBlob(state.audioDuration)
                .then(blob => {
                    state.audioBlob = blob;
                    
                    // Convert to base64 for API
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result;
                        if (result.startsWith('data:audio/wav;base64,')) {
                            state.audioBase64 = result.split(',')[1];
                        } else {
                            state.audioBase64 = btoa(reader.result);
                        }
                        
                        // Update audio preview
                        const audioPreview = document.getElementById('audioPreview');
                        const audioURL = URL.createObjectURL(blob);
                        audioPreview.src = audioURL;
                        
                        // Clean up URL
                        audioPreview.onloadeddata = () => {
                            URL.revokeObjectURL(audioURL);
                        };
                        
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error('Audio blob creation failed:', error);
                    resolve(); // Continue anyway
                });
        }, 1000);
    });
}

function createMockAudioBlob(duration) {
    return new Promise((resolve) => {
        const sampleRate = 44100;
        const numSamples = Math.floor(duration * sampleRate);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);
        
        // Write WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, numSamples * 2, true);
        
        // Create silent audio
        const blob = new Blob([buffer], { type: 'audio/wav' });
        resolve(blob);
    });
}

function generateSubtitles(text, duration) {
    // Split text into optimal lines for Shorts
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = [];
    let currentLength = 0;
    
    for (const word of words) {
        if (currentLength + word.length + 1 > 35 && currentLine.length > 0) {
            lines.push(currentLine.join(' '));
            currentLine = [word];
            currentLength = word.length;
        } else {
            currentLine.push(word);
            currentLength += word.length + 1;
        }
    }
    
    if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
    }
    
    // Limit to 2 lines maximum
    if (lines.length > 2) {
        const mergedLine = lines.slice(0, 2).join(' ');
        lines.length = 0;
        lines.push(mergedLine);
    }
    
    // Calculate timing (simple proportional)
    const lineDuration = duration / Math.max(1, lines.length);
    
    // Generate ASS subtitles
    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 384
PlayResY: 512
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ArchNemix,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,0.5,2,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    
    let currentTime = 0;
    lines.forEach((line, index) => {
        const start = formatTime(currentTime);
        const end = formatTime(currentTime + lineDuration);
        assContent += `Dialogue: 0,${start},${end},ArchNemix,,0,0,0,,${line}\\N`;
        currentTime += lineDuration;
    });
    
    return assContent;
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(5, '0')}`;
}

function updateGenerationInfo() {
    const scriptLength = state.script.length;
    document.getElementById('infoLength').textContent = `${scriptLength} characters`;
    
    const duration = Math.round(state.audioDuration * 10) / 10;
    document.getElementById('infoDuration').textContent = `${duration}s`;
    
    document.getElementById('infoBackground').textContent = state.selectedVideo ? 
        state.selectedVideo.toUpperCase() : 'Not selected';
    
    // Calculate estimated time (10s base + 0.5s per second of audio)
    const estimatedTime = Math.round(10 + (state.audioDuration * 0.5));
    document.getElementById('infoTime').textContent = `${estimatedTime}s`;
}

async function generateVideo() {
    // Validation
    if (!state.audioBase64 || !state.subtitlesASS || !state.selectedVideo) {
        Toast.show('Please complete all previous steps', 'error');
        return;
    }
    
    if (state.audioBase64.length < 100) {
        Toast.show('Audio data appears to be invalid', 'error');
        return;
    }
    
    const generateBtn = document.getElementById('generateVideoBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Update UI
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    state.isProcessing = true;
    
    statusMessage.innerHTML = `
        <i class="fas fa-robot"></i> 
        Initializing ArchNemix AI Pipeline...
    `;
    statusMessage.className = 'status-message';
    
    // Reset progress
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressText').textContent = 'Starting generation...';
    
    try {
        // Call backend API
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
            throw new Error(`API error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        state.currentJobId = data.job_id;
        
        // Update UI with job info
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}...
            <br><small>Estimated time: ${data.estimated_time || 30}s</small>
        `;
        statusMessage.className = 'status-message status-success';
        
        // Start polling for status
        startJobPolling();
        
        Toast.show('Video generation started', 'success');
        
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
    
    state.jobPollInterval = setInterval(async () => {
        if (!state.currentJobId) {
            clearInterval(state.jobPollInterval);
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/job/${state.currentJobId}`);
            if (!response.ok) {
                throw new Error(`Status check failed: ${response.status}`);
            }
            
            const data = await response.json();
            updateJobStatus(data);
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000); // Poll every 3 seconds
}

function updateJobStatus(data) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const statusMessage = document.getElementById('statusMessage');
    const resultSection = document.getElementById('resultSection');
    const generateBtn = document.getElementById('generateVideoBtn');
    
    if (data.status === 'processing' || data.status === 'pending') {
        // Update progress
        const progress = data.progress || 0;
        progressFill.style.width = `${progress}%`;
        progressPercent.textContent = `${progress}%`;
        progressText.textContent = data.message || 'Processing...';
        
        statusMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <strong>Processing:</strong> ${data.message || 'Generating your short...'}
        `;
        
    } else if (data.status === 'completed') {
        // Stop polling
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
        // Update UI
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressText.textContent = 'Completed!';
        
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Success!</strong> Video generation completed.
        `;
        statusMessage.className = 'status-message status-success';
        
        // Show result section
        const resultVideo = document.getElementById('resultVideo');
        const downloadBtn = document.getElementById('downloadBtn');
        
        const videoUrl = `${API_URL}/download/${state.currentJobId}`;
        resultVideo.src = videoUrl;
        downloadBtn.href = videoUrl;
        downloadBtn.download = `archnemix-short-${state.currentJobId.substring(0, 8)}.mp4`;
        
        resultSection.style.display = 'block';
        generateBtn.style.display = 'none';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success');
        
    } else if (data.status === 'failed') {
        // Stop polling
        if (state.jobPollInterval) {
            clearInterval(state.jobPollInterval);
            state.jobPollInterval = null;
        }
        
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
        
        Toast.show('Video generation failed', 'error');
        
    } else if (data.status === 'rate_limited') {
        statusMessage.innerHTML = `
            <i class="fas fa-clock" style="color: var(--warning);"></i>
            <strong>Rate Limited:</strong> Too many status checks...
        `;
    }
}

function resetApplication() {
    // Stop any polling
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
    
    // Reset UI
    document.getElementById('scriptInput').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('charCounter').className = 'char-counter';
    
    document.getElementById('audioPreview').src = '';
    document.getElementById('audioStatus').innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Audio" to preview your script';
    document.getElementById('audioStatus').className = 'status-message';
    
    document.getElementById('subtitlePreview').innerHTML = '<i class="fas fa-closed-captioning"></i> Subtitles will be generated automatically';
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
    
    // Go back to step 1 and auto-select first video
    goToStep(1);
    const firstVideo = document.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
    
    Toast.show('Ready for new creation', 'info');
}

// Helper function for WAV header
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Debug utilities
window.debugState = () => {
    console.log('🔍 ArchNemix State:', {
        scriptLength: state.script.length,
        audioDuration: state.audioDuration,
        selectedVideo: state.selectedVideo,
        hasSubtitles: !!state.subtitlesASS,
        hasAudio: !!state.audioBase64,
        currentJob: state.currentJobId,
        isProcessing: state.isProcessing
    });
    return state;
};

window.testBackend = async () => {
    try {
        const endpoints = ['/', '/health', '/videos/minecraft'];
        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                results[endpoint] = {
                    status: response.status,
                    ok: response.ok
                };
                
                if (response.ok) {
                    const data = await response.json();
                    results[endpoint].data = data;
                }
            } catch (error) {
                results[endpoint] = { error: error.message };
            }
        }
        
        console.log('🔧 Backend Test Results:', results);
        Toast.show('Backend test complete', 'info');
        return results;
        
    } catch (error) {
        console.error('Backend test failed:', error);
        Toast.show('Backend test failed', 'error');
        return null;
    }
};

console.log('🚀 ArchNemix UI Loaded Successfully');
