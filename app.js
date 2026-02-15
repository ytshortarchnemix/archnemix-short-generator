// ArchNemix Shorts Generator - With REAL Word Timestamps from Piper TTS + Forced Alignment
// Configuration
const API_URL = "https://ytshortmakerarchx-ytshrt-archx-mc-1.hf.space";
const TTS_API = "https://ytshortmakerarchx-piper-tts-male-01.hf.space";
const ALIGN_API = "https://ytshortmakerarchx-archxaudsbt.hf.space"; // 🔥 NEW: Forced alignment service
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
    wordTimestamps: []  // Store word-level timestamps (upgraded by aligner)
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
        console.log('Loading voices from TTS API...');
        
        const response = await fetch(`${TTS_API}/voices`);
        
        if (!response.ok) {
            throw new Error('Failed to load voices from TTS API');
        }
        
        const data = await response.json();
        state.availableTTSVoices = data.voices || [];
        
        const select = document.getElementById('voiceSelect');
        select.innerHTML = '';
        
        if (state.availableTTSVoices.length > 0) {
            state.availableTTSVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.id;
                option.textContent = voice.name;
                select.appendChild(option);
            });
            
            select.value = state.availableTTSVoices[0].id;
            
            console.log(`✅ Loaded ${state.availableTTSVoices.length} TTS voices`);
            Toast.show(`${state.availableTTSVoices.length} voices loaded`, 'success');
        } else {
            select.innerHTML = '<option value="">No voices available</option>';
            Toast.show('No TTS voices found', 'warning');
        }
        
    } catch (error) {
        console.error('Failed to load TTS voices:', error);
        
        const select = document.getElementById('voiceSelect');
        select.innerHTML = `
            <option value="ryan">Ryan - American Male (Clear)</option>
            <option value="joe">Joe - American Male (Deep)</option>
            <option value="libritts">Libritts - American Male (Neutral)</option>
        `;
        select.value = 'ryan';
        
        state.availableTTSVoices = [
            { id: 'ryan', name: 'Ryan - American Male (Clear)' },
            { id: 'joe', name: 'Joe - American Male (Deep)' },
            { id: 'libritts', name: 'Libritts - American Male (Neutral)' }
        ];
        
        Toast.show('Using default voices', 'warning');
    }
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

// ============== REAL AUDIO GENERATION WITH PIPER TTS ==============
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
    
    audioStatus.innerHTML = `<i class="fas fa-robot"></i> Generating AI voiceover with Piper TTS...`;
    audioStatus.className = 'status-message';
    
    audioBtn.disabled = true;
    audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    audioPreview.src = '';
    
    document.getElementById('nextStep2').disabled = true;
    document.getElementById('prevStep2').disabled = true;
    
    try {
        console.log('🎙️ Calling Piper TTS API...');
        console.log('Voice:', voiceId, 'Rate:', rate, 'Text length:', state.script.length);
        
        await generateRealAudio(state.script, voiceId, rate);
        
        console.log('📝 Generating subtitles with REAL timestamps from forced alignment');
        state.subtitlesASS = generateSubtitles(state.script, state.audioDuration, state.wordTimestamps);
        
        audioStatus.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Audio generated successfully (${state.audioDuration.toFixed(1)}s)`;
        audioStatus.className = 'status-message status-success';
        
        document.getElementById('nextStep2').disabled = false;
        document.getElementById('prevStep2').disabled = false;
        
        const preview = document.getElementById('subtitlePreview');
        const words = state.wordTimestamps.length || state.script.split(/\s+/).length;
        const syncType = state.wordTimestamps.length > 0 ? 'PERFECTLY SYNCED' : 'Auto-timed';
        preview.innerHTML = `
            <i class="fas fa-closed-captioning" style="color: var(--success);"></i>
            <strong>Subtitles Ready:</strong> ${words} words • ${Math.round(state.audioDuration)}s • ${syncType}
        `;
        preview.className = 'status-message status-success';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio';
        
        Toast.show(`Audio generated: ${state.audioDuration.toFixed(1)}s with ${words} word timestamps`, 'success');
        
    } catch (error) {
        console.error('❌ Audio generation failed:', error);
        
        audioStatus.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--error);"></i> ${error.message}`;
        audioStatus.className = 'status-message status-error';
        
        audioBtn.disabled = false;
        audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio';
        document.getElementById('prevStep2').disabled = false;
        
        Toast.show('Audio generation failed: ' + error.message, 'error', 5000);
    }
}

// ============== FORCED ALIGNMENT SERVICE (PERFECT TIMESTAMPS) ==============
async function getWordTimestampsFromAligner(audioBase64, script) {
    try {
        console.log('🎯 Calling forced alignment service with user script...');
        const response = await fetch(`${ALIGN_API}/align`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_base64: audioBase64,
                text: script
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Aligner error (${response.status}): ${error}`);
        }

        const data = await response.json();
        console.log(`✅ Alignment success: ${data.word_timestamps.length} word timestamps`);
        return data.word_timestamps;
    } catch (error) {
        console.error('❌ Forced alignment failed:', error);
        throw error; // Re-throw to signal failure
    }
}

async function generateRealAudio(text, voiceId, rate) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Calling TTS API: ${TTS_API}/tts`);
            
            const response = await fetch(`${TTS_API}/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voiceId,
                    rate: rate
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS API error:', response.status, errorText);
                
                let errorMsg = 'TTS generation failed';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.detail || errorMsg;
                } catch (e) {
                    errorMsg = `TTS API error: ${response.status}`;
                }
                
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            console.log('✅ TTS API response received');
            console.log('Duration:', data.duration, 'Audio format:', data.audio_format);
            
            state.audioDuration = data.duration;
            state.audioBase64 = data.audio_base64;
            
            // 1. Clear any old timestamps
            state.wordTimestamps = [];
            
            // 2. 🔥 ALWAYS use forced alignment with user's EXACT script for perfect sync
            try {
                console.log('🎯 Starting forced alignment with user script...');
                const alignerTimestamps = await getWordTimestampsFromAligner(state.audioBase64, text);
                
                if (alignerTimestamps && alignerTimestamps.length > 0) {
                    state.wordTimestamps = alignerTimestamps;
                    console.log(`✨ SUCCESS: ${alignerTimestamps.length} FORCED ALIGNMENT timestamps – PERFECT SYNC!`);
                } else {
                    throw new Error('No timestamps returned from aligner');
                }
            } catch (alignError) {
                console.error('⚠️ Forced alignment failed:', alignError);
                // Use Piper timestamps as fallback if available
                if (data.word_timestamps && data.word_timestamps.length > 0) {
                    state.wordTimestamps = data.word_timestamps;
                    console.log(`⚠️ Using ${data.word_timestamps.length} Piper TTS timestamps as fallback`);
                } else {
                    console.warn('⚠️ No timestamps available - will use estimation fallback');
                }
            }
            
            const audioBytes = atob(data.audio_base64);
            const audioArray = new Uint8Array(audioBytes.length);
            for (let i = 0; i < audioBytes.length; i++) {
                audioArray[i] = audioBytes.charCodeAt(i);
            }
            
            const mimeType = data.audio_format === 'wav' ? 'audio/wav' : 'audio/mpeg';
            state.audioBlob = new Blob([audioArray], { type: mimeType });
            
            const audioPreview = document.getElementById('audioPreview');
            const blobUrl = URL.createObjectURL(state.audioBlob);
            audioPreview.src = blobUrl;
            
            console.log(`✅ Audio blob created: ${state.audioBlob.size} bytes, ${state.audioDuration}s`);
            
            if (state.wordTimestamps.length > 0) {
                console.log(`✅ Final: ${state.wordTimestamps.length} word timestamps ready for subtitle sync`);
            } else {
                console.warn('⚠️ No word timestamps - will use fallback timing');
            }
            
            resolve();
            
        } catch (error) {
            console.error('TTS generation error:', error);
            reject(error);
        }
    });
}

// ============================================================
// SUBTITLE GENERATION WITH REAL WORD TIMESTAMPS
// Uses actual timing data from forced alignment for perfect sync
// ============================================================

function generateSubtitles(text, duration, wordTimestamps = []) {
    // If we have real timestamps from forced alignment, use them!
    if (wordTimestamps && wordTimestamps.length > 0) {
        return generateSubtitlesFromTimestamps(wordTimestamps);
    }
    
    // Fallback: use the old estimation method if timestamps unavailable
    console.warn('⚠️ Using fallback subtitle timing (no timestamps from forced alignment)');
    return generateSubtitlesFallback(text, duration);
}

function generateSubtitlesFromTimestamps(wordTimestamps) {
    if (wordTimestamps.length === 0) return '';
    
    console.log(`🎯 Generating subtitles from ${wordTimestamps.length} REAL word timestamps`);
    
    // ── Step 1: Group words into lines (max 22 chars for portrait) ─────────
    const MAX_CHARS = 22;
    const lines = [];
    let curWords = [], curLen = 0;
    
    for (const ts of wordTimestamps) {
        const word = ts.word;
        const addLen = curLen === 0 ? word.length : word.length + 1;
        
        if (addLen + curLen > MAX_CHARS && curWords.length > 0) {
            lines.push(curWords);
            curWords = [ts];
            curLen = word.length;
        } else {
            curWords.push(ts);
            curLen += addLen;
        }
    }
    if (curWords.length > 0) lines.push(curWords);
    
    // ── Step 2: Pair lines into 2-line blocks ──────────────────────────────
    const blocks = [];
    for (let i = 0; i < lines.length; i += 2) {
        const group = i + 1 < lines.length ? [lines[i], lines[i + 1]] : [lines[i]];
        const allWords = group.flat();
        blocks.push({
            lines: group,
            allWords: allWords,
            start: allWords[0].start,
            end: allWords[allWords.length - 1].end
        });
    }
    
    // ── Step 3: Build ASS file with per-word highlighting ─────────────────
    const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
    
    const WHITE = '{\\c&H00FFFFFF&}';
    const YELLOW = '{\\c&H0000FFFF&}';
    const RESET = '{\\r}';
    
    const dialogueLines = [];
    
    blocks.forEach(block => {
        block.allWords.forEach(activeWord => {
            const lineStrings = block.lines.map(line => {
                return line.map(w => {
                    if (w === activeWord) {
                        return `${YELLOW}${w.word}${RESET}${WHITE}`;
                    }
                    return `${WHITE}${w.word}`;
                }).join(' ');
            });
            
            const fullText = lineStrings.join('\\N');
            
            // Use REAL timestamps from forced alignment!
            dialogueLines.push(
                `Dialogue: 0,${formatASSTime(activeWord.start)},${formatASSTime(activeWord.end)},Default,,0,0,0,,${fullText}`
            );
        });
    });
    
    console.log(`✅ Generated ${dialogueLines.length} perfectly synced subtitle lines from forced alignment`);
    
    return assHeader + '\n' + dialogueLines.join('\n') + '\n';
}

// Fallback method if forced alignment doesn't work
function generateSubtitlesFallback(text, duration) {
    const rawWords = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (rawWords.length === 0) return '';
    
    console.log('⚠️ Using estimation-based timing (forced alignment not available)');
    
    const words = rawWords.map(w => {
        const clean = w.replace(/^["""''([{]/, '').replace(/["""'').,!?;:\]}]+$/, '');
        const type = _subDetectSpecial(clean);
        return { text: w, type, rawDur: _subEstimateDuration(clean, type) };
    });
    
    const totalRaw = words.reduce((s, w) => s + w.rawDur, 0);
    const scale = totalRaw > 0 ? duration / totalRaw : 1;
    
    let t = 0;
    const wordTimestamps = words.map(w => {
        const dur = w.rawDur * scale;
        const ts = {
            word: w.text,
            start: parseFloat(t.toFixed(3)),
            end: parseFloat((t + dur).toFixed(3))
        };
        t = ts.end;
        return ts;
    });
    
    return generateSubtitlesFromTimestamps(wordTimestamps);
}

// Helper functions for fallback estimation
function _subDetectSpecial(word) {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(word)) return 'ip';
    if (/^https?:\/\//i.test(word)) return 'url';
    if (/^www\./i.test(word)) return 'url';
    if (/^localhost$/i.test(word)) return 'localhost';
    if (/^[A-Z]{3,}$/.test(word)) return 'acronym';
    if (/^\/[\w.\-/]+$/.test(word)) return 'path';
    if (/^[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}$/.test(word)) return 'email';
    return null;
}

function _subEstimateDuration(word, type) {
    if (type === 'ip') {
        const parts = word.split('.');
        const dur = parts.reduce((s, p) => s + p.length * 0.28, 0) + (parts.length - 1) * 0.32;
        return Math.max(dur, 2.0);
    }
    if (type === 'url') return Math.min(word.length * 0.22, 8.0);
    if (type === 'localhost') return 0.85;
    if (type === 'acronym') return word.length * 0.35;
    if (type === 'path') {
        const segs = word.split('/').filter(Boolean);
        return segs.reduce((s, sg) => s + 0.3 + sg.length * 0.05, 0.2);
    }
    if (type === 'email') return Math.min(word.length * 0.18, 5.0);
    
    let dur = 0.38 + word.length * 0.048;
    if (/[.!?]$/.test(word)) dur += 0.18;
    if (/[,;:]$/.test(word)) dur += 0.08;
    return dur;
}

// ============================================================
// END SUBTITLE GENERATION
// ============================================================

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
        Initializing ArchNemix AI Pipeline with PERFECT subtitle sync...
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
        
        statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}...
            <br><small>Estimated time: ${data.estimated_time || 30}s</small>
        `;
        statusMessage.className = 'status-message status-success';
        
        startJobPolling();
        
        Toast.show('Video generation started with perfect subtitle sync', 'success');
        
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
            <strong>Success!</strong> Video generation completed with PERFECT subtitle sync.
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
        wordTimestamps: state.wordTimestamps.length
    });
    return state;
};

window.testBackend = async () => {
    try {
        const results = { tts: {}, video: {} };
        
        console.log('Testing TTS API...');
        try {
            const ttsResponse = await fetch(`${TTS_API}/`);
            results.tts.root = { status: ttsResponse.status, ok: ttsResponse.ok };
            if (ttsResponse.ok) results.tts.root.data = await ttsResponse.json();
            
            const voicesResponse = await fetch(`${TTS_API}/voices`);
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

window.testTTS = async (text = "Hello world, this is a test.") => {
    try {
        console.log('Testing TTS with text:', text);
        
        const response = await fetch(`${TTS_API}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: 'ryan',
                rate: 1.0
            })
        });
        
        if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
        
        const data = await response.json();
        console.log('✅ TTS Test Success:', data);
        console.log('Word timestamps:', data.word_timestamps);
        
        const audio = new Audio('data:audio/wav;base64,' + data.audio_base64);
        audio.play();
        
        Toast.show('TTS test successful', 'success');
        return data;
        
    } catch (error) {
        console.error('TTS test failed:', error);
        Toast.show('TTS test failed', 'error');
        return null;
    }
};

console.log('🚀 ArchNemix Shorts Generator v10.1 - FORCED ALIGNMENT WITH USER SCRIPT');
console.log('🎯 Perfect subtitle sync using user script + Wav2Vec2 forced alignment');
console.log('📝 Available commands: debugState(), testBackend(), testTTS()');
