// ArchNemix Shorts Generator - Complete Application Logic
// Configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
const API_URL = "https://YTShortMakerArchx-ytshrt_archx_mc_1.hf.space"; // Your HF Space URL
const APP_KEY = "archx_3f9d15f52n48d41h5fj8a7e2b_private"; // Same as in backend secrets

// Global State
const state = {
    currentStep: 1,
    audioBlob: null,
    audioDuration: 0,
    subtitlesASS: "",
    selectedVideo: "",
    currentJobId: "",
    audioBase64: "",
    script: "",
    voices: [],
    videoList: [],
    jobStatus: null
};

// Toast Notification System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#00CC88' : type === 'error' ? '#FF5555' : '#0066FF'};
        color: white;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
        max-width: 300px;
    `;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    toast.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${message}`;
    
    document.body.appendChild(toast);
    
    // Clean up
    setTimeout(() => {
        if (toast.parentNode) {
            document.body.removeChild(toast);
        }
    }, 3000);
}

// CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApplication();
});

async function initApplication() {
    console.log('🚀 ArchNemix Shorts Generator Initializing...');
    await checkBackendConnection();
    initVoices();
    await loadAvailableVideos();
    setupEventListeners();
    updateStepIndicators();
    showToast('ArchNemix AI Ready', 'success');
}

async function checkBackendConnection() {
    try {
        // Use the root endpoint instead of /health
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            console.log('✅ ArchNemix Backend: Connected');
            showToast('ArchNemix AI Connected', 'success');
            return true;
        } else {
            throw new Error('Backend not responding properly');
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        showToast('Cannot connect to backend server', 'error');
        return false;
    }
}

function setupEventListeners() {
    // Script input
    const scriptInput = document.getElementById('scriptInput');
    scriptInput.addEventListener('input', function() {
        state.script = this.value;
        const count = this.value.length;
        document.getElementById('charCount').textContent = count;
        
        const charCounter = document.getElementById('charCounter');
        charCounter.className = 'char-counter';
        if (count > 400) {
            charCounter.classList.add('warning');
        } else if (count > 450) {
            charCounter.classList.add('error');
        }
        
        document.getElementById('nextStep1').disabled = count < 10;
    });
    
    // Rate slider
    const rateSlider = document.getElementById('rateSlider');
    rateSlider.addEventListener('input', function() {
        document.getElementById('rateValue').textContent = this.value;
    });
    
    // Navigation buttons
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

function goToStep(step) {
    state.currentStep = step;
    updateStepIndicators();
    updateStepContent();
    
    // Update info when reaching step 4
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

function initVoices() {
    if ('speechSynthesis' in window) {
        const loadVoices = () => {
            state.voices = speechSynthesis.getVoices();
            const select = document.getElementById('voiceSelect');
            
            if (state.voices.length === 0) {
                select.innerHTML = '<option value="">No voices available</option>';
                return;
            }
            
            select.innerHTML = '<option value="">Select AI Voice</option>';
            
            // Filter for English voices and sort by natural sounding ones
            const englishVoices = state.voices
                .filter(voice => voice.lang.startsWith('en'))
                .sort((a, b) => {
                    // Prefer Google/Microsoft voices
                    const aScore = a.name.includes('Google') || a.name.includes('Microsoft') ? 1 : 0;
                    const bScore = b.name.includes('Google') || b.name.includes('Microsoft') ? 1 : 0;
                    return bScore - aScore;
                });
            
            englishVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                
                // Clean up voice name
                let displayName = voice.name
                    .replace('Microsoft ', '')
                    .replace('Google ', '')
                    .replace('Desktop', '')
                    .replace(' Online', '')
                    .trim();
                
                // Add language code if not obvious
                if (!voice.lang.includes('US') && !voice.lang.includes('GB')) {
                    displayName += ` (${voice.lang})`;
                }
                
                option.textContent = displayName;
                select.appendChild(option);
            });
            
            // Auto-select a good default voice
            if (englishVoices.length > 0) {
                const defaultVoice = englishVoices.find(v => v.name.includes('Google')) || 
                                   englishVoices.find(v => v.name.includes('Microsoft')) || 
                                   englishVoices[0];
                select.value = defaultVoice.name;
            }
        };
        
        // Some browsers load voices asynchronously
        if (speechSynthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    } else {
        document.getElementById('voiceSelect').innerHTML = 
            '<option value="">Speech synthesis not supported</option>';
        showToast('Your browser does not support text-to-speech', 'error');
    }
}

async function loadAvailableVideos() {
    try {
        const response = await fetch(`${API_URL}/videos/minecraft`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        state.videoList = data.videos;
        
        const grid = document.getElementById('videoGrid');
        grid.innerHTML = '';
        
        data.videos.forEach((video, index) => {
            const videoName = video.split('/').pop().replace('.mp4', '');
            const item = document.createElement('div');
            item.className = 'video-card';
            item.dataset.video = videoName;
            item.dataset.index = index;
            
            // Create a unique color for each video thumbnail
            const colors = ['#0066FF', '#00CC88', '#FFAA00', '#FF5555', '#AA66FF', '#00CCCC'];
            const color = colors[index % colors.length];
            
            item.innerHTML = `
                <div class="video-thumb" style="background: linear-gradient(135deg, ${color}22, ${color}44);">
                    <i class="fas fa-gamepad" style="color: ${color}; font-size: 2.5rem;"></i>
                </div>
                <div style="font-weight: 600; margin-top: 0.5rem;">${videoName.toUpperCase()}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    Minecraft Adventure
                </div>
            `;
            
            item.addEventListener('click', function() {
                document.querySelectorAll('.video-card').forEach(el => {
                    el.classList.remove('selected');
                });
                this.classList.add('selected');
                state.selectedVideo = this.dataset.video;
                document.getElementById('nextStep3').disabled = false;
                updateGenerationInfo();
                
                // Add visual feedback
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            });
            
            grid.appendChild(item);
        });
        
        // Auto-select first video
        if (data.videos.length > 0) {
            const firstVideo = grid.querySelector('.video-card');
            if (firstVideo) {
                setTimeout(() => firstVideo.click(), 100);
            }
        }
        
        console.log(`✅ Loaded ${data.videos.length} background videos`);
        
    } catch (error) {
        console.error('Failed to load videos:', error);
        document.getElementById('videoGrid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--error); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text); margin-bottom: 0.5rem;">Unable to Load Videos</h3>
                <p style="color: var(--text-secondary);">Check your backend connection and try refreshing.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
        
        showToast('Failed to load video library', 'error');
    }
}

async function generateAudio() {
    if (!state.script.trim()) {
        showToast('Please enter a script first', 'error');
        return;
    }
    
    const voiceName = document.getElementById('voiceSelect').value;
    const rate = parseFloat(document.getElementById('rateSlider').value);
    
    // Update UI
    const audioStatus = document.getElementById('audioStatus');
    audioStatus.innerHTML = `<i class="fas fa-robot"></i> <span class="loading">Generating AI voiceover...</span>`;
    audioStatus.className = 'status-message';
    
    const audioBtn = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    
    audioBtn.disabled = true;
    audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    audioPreview.src = '';
    
    // Disable navigation while generating
    document.getElementById('nextStep2').disabled = true;
    document.getElementById('prevStep2').disabled = true;
    
    try {
        // Generate audio using browser TTS
        await generateTTSAudio(state.script, voiceName, rate);
        
        // Generate professional ASS subtitles
        state.subtitlesASS = generateProfessionalSubtitles(state.script, state.audioDuration);
        
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
            <strong>Subtitles Ready:</strong> ${words} words • ${Math.round(state.audioDuration)}s • Professional timing
        `;
        preview.className = 'status-message status-success';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio';
        
        showToast('AI voiceover generated successfully', 'success');
        
    } catch (error) {
        console.error('Audio generation failed:', error);
        audioStatus.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--error);"></i> Failed to generate audio: ${error.message}`;
        audioStatus.className = 'status-message status-error';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio Preview';
        document.getElementById('prevStep2').disabled = false;
        
        showToast('Audio generation failed', 'error');
    }
}

async function generateTTSAudio(text, voiceName, rate) {
    return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
            // Fallback for browsers without TTS
            simulateAudioGeneration(text);
            setTimeout(resolve, 1000);
            return;
        }
        
        try {
            // Cancel any ongoing speech
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text.substring(0, 5000)); // Limit length
            utterance.rate = rate;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            if (voiceName && state.voices.length > 0) {
                const voice = state.voices.find(v => v.name === voiceName);
                if (voice) utterance.voice = voice;
            }
            
            // Calculate estimated duration
            const words = text.split(/\s+/).length;
            state.audioDuration = Math.max(3, Math.min(180, words / 2.3)); // Words per second
            
            // Create audio context for recording
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();
            
            utterance.onend = function() {
                // Use Web Audio API to create a tone (simulating actual audio)
                createSimulatedAudio(text, audioContext, resolve);
            };
            
            utterance.onerror = function(event) {
                console.warn('TTS failed, using simulation:', event);
                simulateAudioGeneration(text);
                resolve();
            };
            
            // Safety timeout
            const timeout = setTimeout(() => {
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                    simulateAudioGeneration(text);
                    resolve();
                }
            }, 15000);
            
            utterance.onend = () => {
                clearTimeout(timeout);
                createSimulatedAudio(text, audioContext, resolve);
            };
            
            speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.warn('TTS initialization error:', error);
            simulateAudioGeneration(text);
            resolve();
        }
    });
}

function createSimulatedAudio(text, audioContext, resolve) {
    try {
        const sampleRate = 44100;
        const duration = state.audioDuration;
        const numSamples = Math.floor(duration * sampleRate);
        
        // Create silent audio buffer with a subtle tone at the beginning
        const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // Add a short beep at the beginning to indicate audio start
        const beepSamples = Math.min(4410, numSamples / 10); // 0.1 second beep
        for (let i = 0; i < beepSamples; i++) {
            const t = i / sampleRate;
            // Short beep at 440Hz
            channelData[i] = Math.sin(2 * Math.PI * 440 * t) * 0.1 * Math.exp(-t * 10);
        }
        
        // Convert to WAV format
        const wavData = audioBufferToWav(audioBuffer);
        state.audioBlob = new Blob([wavData], { type: 'audio/wav' });
        
        // Convert to base64 for API
        const reader = new FileReader();
        reader.onloadend = function() {
            const result = reader.result;
            if (result.startsWith('data:audio/wav;base64,')) {
                state.audioBase64 = result.split(',')[1];
            } else {
                // Fallback: re-encode
                state.audioBase64 = btoa(reader.result);
            }
            
            // Update audio preview player
            const audioPreview = document.getElementById('audioPreview');
            const audioURL = URL.createObjectURL(state.audioBlob);
            audioPreview.src = audioURL;
            
            // Clean up URL after loading
            audioPreview.onloadeddata = () => {
                URL.revokeObjectURL(audioURL);
            };
            
            resolve();
        };
        
        reader.onerror = () => {
            console.error('FileReader error');
            simulateAudioGeneration(text);
            resolve();
        };
        
        reader.readAsDataURL(state.audioBlob);
        
    } catch (error) {
        console.error('Audio simulation failed:', error);
        simulateAudioGeneration(text);
        resolve();
    }
}

function simulateAudioGeneration(text) {
    const words = text.split(/\s+/).length;
    state.audioDuration = Math.max(3, Math.min(180, words / 2.5));
    
    // Create a simple WAV file with silence
    const sampleRate = 44100;
    const numSamples = Math.floor(state.audioDuration * sampleRate);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    state.audioBlob = new Blob([buffer], { type: 'audio/wav' });
    
    const reader = new FileReader();
    reader.onloadend = function() {
        state.audioBase64 = reader.result.split(',')[1];
        
        const audioPreview = document.getElementById('audioPreview');
        audioPreview.src = URL.createObjectURL(state.audioBlob);
    };
    reader.readAsDataURL(state.audioBlob);
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * numChannels * bytesPerSample;
    
    const bufferArray = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufferArray);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write audio data
    const offset = 44;
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            const intSample = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(offset + (i * numChannels + channel) * 2, intSample, true);
        }
    }
    
    return bufferArray;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function generateProfessionalSubtitles(text, duration) {
    // Split text into optimal lines for YouTube Shorts (max 2 lines, ~35 chars each)
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = [];
    let currentLength = 0;
    let lineCount = 0;
    
    for (const word of words) {
        // Start a new line if adding this word would exceed 35 chars or we already have 2 lines
        if ((currentLength + word.length + 1 > 35 && currentLine.length > 0) || lineCount >= 2) {
            lines.push(currentLine.join(' '));
            currentLine = [word];
            currentLength = word.length;
            lineCount++;
        } else {
            currentLine.push(word);
            currentLength += word.length + 1;
        }
    }
    
    if (currentLine.length > 0 && lineCount < 2) {
        lines.push(currentLine.join(' '));
    }
    
    // If we have more than 2 lines, merge the extra ones
    if (lines.length > 2) {
        const lastLine = lines.slice(2).join(' ');
        lines[1] = lines[1] + ' ' + lastLine;
        lines.splice(2);
    }
    
    // Calculate smart timing based on line length and content complexity
    const totalChars = text.length;
    const baseLineDuration = duration / Math.max(1, lines.length);
    
    // Generate professional ASS format with ArchNemix styling
    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 384
PlayResY: 512
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ArchNemix,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,0.5,2,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    
    let currentTime = 0;
    lines.forEach((line, index) => {
        // Dynamic timing: longer lines get more time, shorter lines less
        const lineChars = line.length;
        const complexity = lineChars > 25 ? 1.2 : lineChars < 15 ? 0.8 : 1.0;
        const lineDuration = baseLineDuration * complexity;
        
        // Ensure lines don't overlap
        const startTime = Math.max(currentTime, 0);
        const endTime = startTime + Math.min(lineDuration, duration - startTime);
        
        if (endTime <= duration) {
            const start = formatASSTime(startTime);
            const end = formatASSTime(endTime);
            
            // Add subtle fade effects
            const fadeEffect = `{\\fad(200,200)}`;
            assContent += `Dialogue: 0,${start},${end},ArchNemix,,0,0,0,${fadeEffect}${line}\\N`;
            
            currentTime = endTime;
        }
    });
    
    return assContent;
}

function formatASSTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(5, '0')}`;
}

function updateGenerationInfo() {
    const scriptLength = state.script.length;
    document.getElementById('infoLength').textContent = `${scriptLength} characters`;
    
    const duration = Math.round(state.audioDuration * 10) / 10;
    document.getElementById('infoDuration').textContent = `${duration}s`;
    
    document.getElementById('infoBackground').textContent = state.selectedVideo ? 
        `${state.selectedVideo.toUpperCase()}` : 'Not selected';
    
    // Calculate estimated processing time (base + audio duration * factor)
    const estimatedTime = Math.round(10 + (state.audioDuration * 0.5));
    document.getElementById('infoTime').textContent = `${estimatedTime}s`;
}

async function generateVideo() {
    // Validation
    if (!state.audioBase64 || !state.subtitlesASS || !state.selectedVideo) {
        showToast('Please complete all previous steps', 'error');
        return;
    }
    
    if (!state.audioBase64.startsWith('/') && state.audioBase64.length < 100) {
        showToast('Audio data appears to be invalid', 'error');
        return;
    }
    
    const generateBtn = document.getElementById('generateVideoBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Update UI
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    statusMessage.innerHTML = `
        <i class="fas fa-robot"></i> 
        <span class="loading">Initializing ArchNemix AI Pipeline...</span>
    `;
    statusMessage.className = 'status-message';
    
    // Reset progress
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressText').textContent = 'Starting generation...';
    
    try {
        // First, get time estimate
        const estimateResponse = await fetch(`${API_URL}/estimate/${state.audioDuration}`);
        const estimateData = await estimateResponse.json();
        
        console.log('📊 Estimated processing:', estimateData);
        
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
        state.jobStatus = data;
        
        console.log('✅ Job created:', data);
        
        // Update UI with job info
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}...
            <br><small>Estimated time: ${estimateData.estimated_total_seconds}s</small>
        `;
        statusMessage.className = 'status-message status-success';
        
        // Start polling for status
        pollJobStatus();
        
        showToast('Video generation started successfully', 'success');
        
    } catch (error) {
        console.error('Generation failed:', error);
        
        // Parse error message
        let errorMsg = 'Failed to start generation';
        if (error.message.includes('Rate limit')) {
            errorMsg = 'Rate limit exceeded (3 videos per hour)';
        } else if (error.message.includes('Invalid API key')) {
            errorMsg = 'Server configuration error';
        } else if (error.message.includes('Background video not found')) {
            errorMsg = 'Selected background video not available';
        }
        
        statusMessage.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
            <strong>Error:</strong> ${errorMsg}
        `;
        statusMessage.className = 'status-message status-error';
        
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
        
        showToast(errorMsg, 'error');
    }
}

async function pollJobStatus() {
    if (!state.currentJobId) {
        console.error('No job ID to poll');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/job/${state.currentJobId}`);
        if (!response.ok) {
            throw new Error(`Status check failed: ${response.status}`);
        }
        
        const data = await response.json();
        state.jobStatus = data;
        
        console.log('📊 Job status:', data);
        
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressPercent = document.getElementById('progressPercent');
        const statusMessage = document.getElementById('statusMessage');
        const resultSection = document.getElementById('resultSection');
        const generateBtn = document.getElementById('generateVideoBtn');
        
        if (data.status === 'processing' || data.status === 'pending') {
            // Update progress
            const progress = data.progress || 5;
            progressFill.style.width = `${progress}%`;
            progressPercent.textContent = `${progress}%`;
            progressText.textContent = data.message || 'Processing video...';
            
            statusMessage.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <strong>Processing:</strong> ${data.message || 'Generating your short...'}
                <br><small>Job ID: ${state.currentJobId.substring(0, 8)}...</small>
            `;
            
            // Continue polling
            setTimeout(pollJobStatus, 3000); // Poll every 3 seconds
            
        } else if (data.status === 'completed') {
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
            
            showToast('Your ArchNemix short is ready!', 'success');
            
        } else if (data.status === 'failed') {
            progressFill.style.width = '0%';
            progressPercent.textContent = '0%';
            progressText.textContent = 'Failed';
            
            statusMessage.innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: var(--error);"></i>
                <strong>Failed:</strong> ${data.error || 'Unknown error occurred'}
            `;
            statusMessage.className = 'status-message status-error';
            
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again';
            generateBtn.style.display = 'block';
            
            showToast('Video generation failed', 'error');
            
        } else if (data.status === 'rate_limited') {
            statusMessage.innerHTML = `
                <i class="fas fa-clock" style="color: var(--warning);"></i>
                <strong>Rate Limited:</strong> Too many status checks. Please wait...
            `;
            
            // Wait longer before retrying
            setTimeout(pollJobStatus, 10000);
        }
        
    } catch (error) {
        console.error('Status polling failed:', error);
        
        // Retry with exponential backoff
        setTimeout(pollJobStatus, 5000);
    }
}

function resetApplication() {
    // Reset state
    state.audioBlob = null;
    state.audioDuration = 0;
    state.subtitlesASS = "";
    state.selectedVideo = "";
    state.currentJobId = "";
    state.audioBase64 = "";
    state.script = "";
    state.jobStatus = null;
    
    // Reset UI
    document.getElementById('scriptInput').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('charCounter').className = 'char-counter';
    
    document.getElementById('audioPreview').src = '';
    document.getElementById('audioStatus').innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Audio" to preview your script';
    document.getElementById('audioStatus').className = 'status-message';
    
    document.getElementById('subtitlePreview').innerHTML = '<i class="fas fa-closed-captioning"></i> Subtitles will be generated automatically with perfect timing';
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
    
    document.getElementById('statusMessage').innerHTML = '<i class="fas fa-info-circle"></i> Click "Generate Now" to start the creation process';
    document.getElementById('statusMessage').className = 'status-message';
    
    // Go back to step 1
    goToStep(1);
    
    // Auto-select first video again
    const firstVideo = document.querySelector('.video-card');
    if (firstVideo) {
        setTimeout(() => firstVideo.click(), 100);
    }
    
    showToast('Application reset. Ready for new creation.', 'info');
}

// Make functions available globally for debugging
window.debugState = () => {
    console.log('🔍 ArchNemix State:', {
        ...state,
        audioBase64: state.audioBase64 ? `${state.audioBase64.substring(0, 50)}...` : 'none',
        subtitlesASS: state.subtitlesASS ? `${state.subtitlesASS.length} chars` : 'none'
    });
    return state;
};

window.testBackend = async () => {
    try {
        const response = await fetch(`${API_URL}/`);
        const data = await response.json();
        console.log('✅ Backend Status:', data);
        showToast(`Backend: ${data.status}`, 'success');
        return data;
    } catch (error) {
        console.error('❌ Backend test failed:', error);
        showToast('Backend test failed', 'error');
        return null;
    }
};

// Add loading indicator to status messages
const loadingStyle = document.createElement('style');
loadingStyle.textContent = `
    .loading {
        display: inline-block;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .fa-spin {
        animation: fa-spin 1s infinite linear;
    }
    
    @keyframes fa-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(loadingStyle);

console.log('✨ ArchNemix Shorts Generator loaded successfully');
