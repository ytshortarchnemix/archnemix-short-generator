// ArchNemix Shorts Generator - Kokoro-82M ONNX Timestamped
// Exact word timestamps from model's duration predictor (~12.5ms resolution)
// No aligner needed.
// ============================================================================

// ========== CONFIGURATION ==========
const API_URL = "https://ytshortmakerarchx-ytshrt-archx-mc-1.hf.space";
const TTS_API = "https://ytshortmakerarchx-headtts-service.hf.space"; // Kokoro-82M ONNX
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
    wordTimestamps: [],       // original from TTS
    editedTimestamps: [],     // user-edited copy
    previewAnimFrame: null,
    previewAudio: null,
};

// ========== TOAST NOTIFICATION SYSTEM ==========
class Toast {
    static show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const icon = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">${icon}</span>
                <span>${message}</span>
            </div>
        `;

        const colors = { success: '#00CC88', error: '#FF5555', warning: '#FFAA00', info: '#0066FF' };

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
            setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 300);
        }, duration);
    }
}

const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(toastStyles);

// ========== MAIN INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ ArchNemix Shorts Generator v3.1 — ONNX Timestamped + Subtitle Preview');
    initializeApplication();
});

async function initializeApplication() {
    try {
        setupEventListeners();
        await initializeVoices();
        await loadVideos();
        updateStepIndicators();
        Toast.show('Ready — exact timestamps from ONNX model', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        Toast.show('Initialization error', 'error');
    }
}

function setupEventListeners() {
    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput) scriptInput.addEventListener('input', handleScriptInput);

    const rateSlider = document.getElementById('rateSlider');
    if (rateSlider) {
        rateSlider.addEventListener('input', (e) => {
            document.getElementById('rateValue').textContent = e.target.value;
        });
    }

    const navMap = [
        ['nextStep1',          () => goToStep(2)],
        ['prevStep2',          () => goToStep(1)],
        ['nextStep2',          () => goToStep(2.5)],       // → subtitle preview
        ['prevStep2_5',        () => goToStep(2)],          // ← back to audio
        ['applyTimestampEdits', applyTimestampEdits],
        ['nextStep2_5',        () => goToStep(3)],          // → visuals
        ['prevStep3',          () => goToStep(2.5)],        // ← back to preview
        ['nextStep3',          () => goToStep(4)],
        ['prevStep4',          () => goToStep(3)],
        ['generateAudioBtn',   generateAudio],
        ['generateVideoBtn',   generateVideo],
        ['newVideoBtn',        resetApplication],
        ['resetTimestamps',    resetTimestamps],
    ];
    navMap.forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    });

    const audioPreview = document.getElementById('audioPreview');
    if (audioPreview) {
        audioPreview.addEventListener('loadedmetadata', () => {
            state.audioDuration = audioPreview.duration || state.audioDuration;
            updateGenerationInfo();
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

// Steps: 1, 2, 2.5, 3, 4
const STEP_IDS = [1, 2, 2.5, 3, 4];

function goToStep(step) {
    state.currentStep = step;

    // Stop any running preview when leaving step 2.5
    if (step !== 2.5) {
        stopPreview();
    }

    updateStepIndicators();
    updateStepContent();
    if (step === 4) updateGenerationInfo();

    // Initialize preview when entering step 2.5
    if (step === 2.5) {
        initSubtitlePreview();
    }
}

function updateStepIndicators() {
    document.querySelectorAll('.step-indicator').forEach(el => {
        const s = parseFloat(el.dataset.step);
        el.classList.toggle('active', s === state.currentStep);
        el.classList.toggle('completed', s < state.currentStep);
    });
}

function updateStepContent() {
    document.querySelectorAll('.step-content').forEach(el => {
        const s = parseFloat(el.dataset.step);
        el.classList.toggle('active', s === state.currentStep);
    });
}

// ========== VOICE INITIALIZATION ==========
async function initializeVoices() {
    const fallbackVoices = [
        { id: 'male_high',     name: 'Michael (US Male) - High Quality', quality: 'high' },
        { id: 'male_medium',   name: 'Adam (US Male) - Clear',           quality: 'medium' },
        { id: 'female_high',   name: 'Sarah (US Female) - High Quality', quality: 'high' },
        { id: 'female_medium', name: 'Sky (US Female) - Natural',        quality: 'medium' },
    ];

    const select = document.getElementById('voiceSelect');
    if (!select) return;

    const applyVoices = (voices) => {
        state.availableTTSVoices = voices;
        select.innerHTML = '';
        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} [${v.quality.toUpperCase()}]`;
            select.appendChild(opt);
        });
        if (voices.some(v => v.id === 'male_high')) select.value = 'male_high';
    };

    try {
        const resp = await fetch(`${TTS_API}/voices`, { mode: 'cors' });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data = await resp.json();
        const voices = data.voices || [];
        if (voices.length > 0) {
            applyVoices(voices);
            Toast.show(`${voices.length} voices loaded`, 'success');
        } else {
            throw new Error('No voices returned');
        }
    } catch (err) {
        console.warn('Voice load failed, using defaults:', err);
        applyVoices(fallbackVoices);
        Toast.show('Using default voices', 'warning');
    }
}

// ========== VIDEO LOADING ==========
async function loadVideos() {
    try {
        const resp = await fetch(`${API_URL}/videos/minecraft`);
        if (resp.ok) {
            const data = await resp.json();
            renderVideoGrid(data.videos);
            Toast.show(`Loaded ${data.videos.length} videos`, 'success');
            return;
        }
    } catch (e) {
        console.warn('Video API unavailable, using fallback');
    }
    renderVideoGrid(['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6']);
    Toast.show('Using fallback video library', 'warning');
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
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">Minecraft Adventure</div>
        `;

        item.addEventListener('click', function () {
            document.querySelectorAll('.video-card').forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            state.selectedVideo = videoName.replace('.mp4', '');
            const nextBtn = document.getElementById('nextStep3');
            if (nextBtn) nextBtn.disabled = false;
            updateGenerationInfo();
            this.style.transform = 'scale(0.98)';
            setTimeout(() => { this.style.transform = 'scale(1)'; }, 150);
        });

        grid.appendChild(item);
    });

    const first = grid.querySelector('.video-card');
    if (first) setTimeout(() => first.click(), 100);
}

// ========== AUDIO GENERATION ==========
async function generateAudio() {
    if (!state.script.trim()) {
        Toast.show('Please enter a script first', 'error');
        return;
    }

    const voiceId = document.getElementById('voiceSelect')?.value;
    const rate    = parseFloat(document.getElementById('rateSlider')?.value || '1.0');

    if (!voiceId) {
        Toast.show('Please select a voice', 'error');
        return;
    }

    const audioStatus  = document.getElementById('audioStatus');
    const audioBtn     = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    const nextBtn      = document.getElementById('nextStep2');
    const prevBtn      = document.getElementById('prevStep2');

    const setStatus = (html, cls = 'status-message') => {
        if (audioStatus) { audioStatus.innerHTML = html; audioStatus.className = cls; }
    };

    setStatus(`<i class="fas fa-robot"></i> Generating audio with Kokoro-82M...`);
    if (audioBtn)   { audioBtn.disabled = true; audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; }
    if (audioPreview) audioPreview.src = '';
    if (nextBtn)    nextBtn.disabled = true;
    if (prevBtn)    prevBtn.disabled = true;

    try {
        await generateKokoroAudio(state.script, voiceId, rate);

        // Deep-copy timestamps for editing
        state.editedTimestamps = JSON.parse(JSON.stringify(state.wordTimestamps));

        // Build subtitles from timestamps
        state.subtitlesASS = buildSubtitles(state.editedTimestamps);

        console.log(`✅ Done: ${state.audioDuration.toFixed(1)}s, ${state.wordTimestamps.length} words`);

        setStatus(
            `<i class="fas fa-check-circle" style="color:var(--success)"></i>
             Audio ready! ${state.audioDuration.toFixed(1)}s · ${state.wordTimestamps.length} words — preview sync in the next step`,
            'status-message status-success',
        );

        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = false;
        if (audioBtn) { audioBtn.disabled = false; audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio'; }

        Toast.show(`Audio ready — preview & edit sync next`, 'success');

    } catch (error) {
        console.error('❌ Generation failed:', error);
        setStatus(
            `<i class="fas fa-exclamation-circle" style="color:var(--error)"></i> ${error.message}`,
            'status-message status-error',
        );
        if (audioBtn) { audioBtn.disabled = false; audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio'; }
        if (prevBtn)  prevBtn.disabled = false;
        Toast.show('Failed: ' + error.message, 'error', 5000);
    }
}

async function generateKokoroAudio(text, voiceId, rate) {
    const resp = await fetch(`${TTS_API}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ text, voice: voiceId, rate }),
    });

    if (!resp.ok) {
        let msg = `Kokoro-82M HTTP ${resp.status}`;
        try { const j = await resp.json(); msg = j.detail || msg; } catch (_) {}
        throw new Error(msg);
    }

    const data = await resp.json();
    console.log(`Kokoro: ${data.duration}s, ${data.word_timestamps?.length} words`);

    state.wordTimestamps = data.word_timestamps || [];
    state.audioDuration  = data.duration;
    state.audioBase64    = data.audio_base64;

    // Build audio blob for <audio> preview
    const bytes = atob(data.audio_base64);
    const buf   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    state.audioBlob = new Blob([buf], { type: 'audio/wav' });

    const preview = document.getElementById('audioPreview');
    if (preview) preview.src = URL.createObjectURL(state.audioBlob);

    return data;
}

// ========== SUBTITLE BUILD ==========
// How many seconds BEFORE the word to show the subtitle.
const SUBTITLE_LEAD_S = 0.10;

function buildSubtitles(wordTimestamps) {
    if (!wordTimestamps || wordTimestamps.length === 0) return '';

    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: GroupSub,Arial Black,95,&H00FFFFFF,&H00FFFFFF,&H00000000,&HCC000000,-1,0,0,0,100,100,2,0,1,5,3,5,80,80,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    const YELLOW = '{\\c&H00FFFF&\\b1}';
    const WHITE  = '{\\c&H00FFFFFF&\\b0}';
    const RESET  = '{\\r}';
    const TARGET = 3;
    const MAX    = 4;

    const groups = [];
    let current  = [];

    for (const w of wordTimestamps) {
        const text = (w.word || '').trim();
        if (!text) continue;
        current.push(w);
        const last = text[text.length - 1];
        const hardBreak = '.!?'.includes(last);
        const softBreak = ',;:—–'.includes(last) && current.length >= 2;
        const sizeBreak = current.length >= MAX;
        if (hardBreak || softBreak || sizeBreak || current.length >= TARGET) {
            groups.push(current);
            current = [];
        }
    }
    if (current.length) groups.push(current);

    const lines = [];
    for (const group of groups) {
        if (!group.length) continue;
        const cleanWords = group.map(w => (w.word || '').replace(/[{}\\]/g, ''));

        for (let i = 0; i < group.length; i++) {
            const w = group[i];
            let wStart = Math.max(0, w.start - SUBTITLE_LEAD_S);
            let wEnd   = Math.max(wStart + 0.05, w.end - SUBTITLE_LEAD_S);

            const parts = cleanWords.map((word, j) =>
                j === i ? `${YELLOW}${word}${RESET}` : `${WHITE}${word}${RESET}`
            );

            const half   = Math.ceil(parts.length / 2);
            const line1  = parts.slice(0, half).join(' ');
            const line2  = parts.slice(half).join(' ');
            const assText = line1 + (line2 ? '\\N' + line2 : '');

            lines.push(
                `Dialogue: 1,${formatASSTime(wStart)},${formatASSTime(wEnd)},GroupSub,,0,0,0,,${assText}`
            );
        }
    }

    return header + '\n' + lines.join('\n') + '\n';
}

function formatASSTime(seconds) {
    seconds = Math.max(0, seconds);
    const hrs  = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const cs   = Math.round((seconds % 1) * 100);
    return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function updateGenerationInfo() {
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('infoLength',     `${state.script.length} characters`);
    set('infoDuration',   `${Math.round(state.audioDuration * 10) / 10}s`);
    set('infoBackground', state.selectedVideo ? state.selectedVideo.toUpperCase() : 'Not selected');
    set('infoTime',       `${Math.round(10 + state.audioDuration * 0.5)}s`);
}

// ========== SUBTITLE PREVIEW & EDITOR ==========

let previewAudioEl = null;
let previewRAF     = null;
let isPreviewPlaying = false;

function initSubtitlePreview() {
    renderWordEditor();
    setupPreviewAudio();
    renderPhoneSubtitle(0);
    // Reset playback controls
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; playBtn.dataset.playing = '0'; }
}

function setupPreviewAudio() {
    // Reuse blob from state
    if (!state.audioBlob) return;
    if (previewAudioEl) {
        previewAudioEl.pause();
        previewAudioEl.src = '';
    }
    previewAudioEl = new Audio(URL.createObjectURL(state.audioBlob));
    previewAudioEl.addEventListener('ended', () => stopPreview());
    previewAudioEl.addEventListener('timeupdate', () => {
        const t = previewAudioEl.currentTime;
        renderPhoneSubtitle(t);
        updateTimeDisplay(t);
    });
}

function stopPreview() {
    if (previewAudioEl) { previewAudioEl.pause(); previewAudioEl.currentTime = 0; }
    cancelAnimationFrame(previewRAF);
    isPreviewPlaying = false;
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; playBtn.dataset.playing = '0'; }
    renderPhoneSubtitle(0);
    updateTimeDisplay(0);
}

function togglePreviewPlay() {
    if (!previewAudioEl) { setupPreviewAudio(); }
    const playBtn = document.getElementById('previewPlayBtn');
    if (isPreviewPlaying) {
        previewAudioEl.pause();
        isPreviewPlaying = false;
        if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; playBtn.dataset.playing = '0'; }
    } else {
        previewAudioEl.play().catch(e => console.error(e));
        isPreviewPlaying = true;
        if (playBtn) { playBtn.innerHTML = '<i class="fas fa-pause"></i> Pause'; playBtn.dataset.playing = '1'; }
    }
}

function updateTimeDisplay(t) {
    const el = document.getElementById('previewTimeDisplay');
    if (el) el.textContent = `${t.toFixed(2)}s / ${state.audioDuration.toFixed(2)}s`;
}

// Build groups from editedTimestamps (same logic as buildSubtitles)
function buildGroups(timestamps) {
    const TARGET = 3, MAX = 4;
    const groups = [];
    let current  = [];
    for (const w of timestamps) {
        const text = (w.word || '').trim();
        if (!text) continue;
        current.push(w);
        const last = text[text.length - 1];
        const hardBreak = '.!?'.includes(last);
        const softBreak = ',;:—–'.includes(last) && current.length >= 2;
        const sizeBreak = current.length >= MAX;
        if (hardBreak || softBreak || sizeBreak || current.length >= TARGET) {
            groups.push(current);
            current = [];
        }
    }
    if (current.length) groups.push(current);
    return groups;
}

function renderPhoneSubtitle(currentTime) {
    const subContainer = document.getElementById('phoneSubtitleDisplay');
    if (!subContainer) return;

    const ts = state.editedTimestamps;
    if (!ts || ts.length === 0) { subContainer.innerHTML = ''; return; }

    const groups = buildGroups(ts);
    let activeGroup = null;
    let activeWordIdx = -1;

    for (const group of groups) {
        for (let i = 0; i < group.length; i++) {
            const w = group[i];
            const wStart = Math.max(0, w.start - SUBTITLE_LEAD_S);
            const wEnd   = Math.max(wStart + 0.05, w.end - SUBTITLE_LEAD_S);
            if (currentTime >= wStart && currentTime < wEnd) {
                activeGroup   = group;
                activeWordIdx = i;
                break;
            }
        }
        if (activeGroup) break;
    }

    if (!activeGroup) { subContainer.innerHTML = ''; return; }

    const cleanWords = activeGroup.map(w => (w.word || '').replace(/[{}\\]/g, ''));
    const half = Math.ceil(cleanWords.length / 2);

    const renderLine = (words, startIdx) => words.map((word, localIdx) => {
        const globalIdx = startIdx + localIdx;
        const isActive  = globalIdx === activeWordIdx;
        return `<span class="sub-word${isActive ? ' sub-word-active' : ''}">${word}</span>`;
    }).join(' ');

    const line1HTML = renderLine(cleanWords.slice(0, half), 0);
    const line2HTML = cleanWords.length > half ? renderLine(cleanWords.slice(half), half) : '';

    subContainer.innerHTML = `
        <div class="sub-line">${line1HTML}</div>
        ${line2HTML ? `<div class="sub-line">${line2HTML}</div>` : ''}
    `;
}

// ========== WORD TIMESTAMP EDITOR ==========

function renderWordEditor() {
    const container = document.getElementById('wordTimestampEditor');
    if (!container) return;

    const ts = state.editedTimestamps;
    if (!ts || ts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:2rem;">No timestamps available.</p>';
        return;
    }

    let html = `
        <div class="editor-header">
            <span class="editor-col-word">Word</span>
            <span class="editor-col-label">Start (s)</span>
            <span class="editor-col-label">End (s)</span>
            <span class="editor-col-label">Duration</span>
            <span class="editor-col-label">Preview</span>
        </div>
        <div class="editor-rows">
    `;

    ts.forEach((w, idx) => {
        const dur = (w.end - w.start).toFixed(3);
        html += `
            <div class="editor-row" id="edrow-${idx}" data-idx="${idx}">
                <span class="editor-word-text">${escapeHTML(w.word || '')}</span>
                <div class="editor-time-inputs">
                    <input type="number" class="ts-input ts-start" data-idx="${idx}" value="${w.start.toFixed(3)}" min="0" step="0.01" title="Start time (seconds)">
                    <input type="number" class="ts-input ts-end"   data-idx="${idx}" value="${w.end.toFixed(3)}"   min="0" step="0.01" title="End time (seconds)">
                    <span class="ts-dur" id="tsdur-${idx}">${dur}s</span>
                </div>
                <button class="btn-audition" onclick="auditionWord(${idx})" title="Preview this word">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Bind input changes
    container.querySelectorAll('.ts-input').forEach(input => {
        input.addEventListener('change', handleTimestampInputChange);
        input.addEventListener('input',  handleTimestampInputChange);
    });
}

function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function handleTimestampInputChange(e) {
    const idx   = parseInt(e.target.dataset.idx);
    const val   = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) return;

    if (e.target.classList.contains('ts-start')) {
        state.editedTimestamps[idx].start = val;
    } else {
        state.editedTimestamps[idx].end = val;
    }

    // Update duration display
    const w = state.editedTimestamps[idx];
    const durEl = document.getElementById(`tsdur-${idx}`);
    if (durEl) durEl.textContent = `${(w.end - w.start).toFixed(3)}s`;

    // Highlight edited row
    const row = document.getElementById(`edrow-${idx}`);
    if (row) { row.classList.add('edited'); }
}

function auditionWord(idx) {
    // Jump preview audio to word start and play briefly
    if (!previewAudioEl) { setupPreviewAudio(); }
    const w = state.editedTimestamps[idx];
    if (!w) return;
    previewAudioEl.pause();
    isPreviewPlaying = false;
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; }
    previewAudioEl.currentTime = Math.max(0, w.start);
    previewAudioEl.play().catch(e => {});
    setTimeout(() => {
        previewAudioEl.pause();
    }, (w.end - w.start + 0.2) * 1000);
    renderPhoneSubtitle(w.start);
    // Scroll & highlight editor row
    const row = document.getElementById(`edrow-${idx}`);
    if (row) { row.scrollIntoView({ behavior:'smooth', block:'nearest' }); row.classList.add('auditioned'); setTimeout(() => row.classList.remove('auditioned'), 800); }
}

function applyTimestampEdits() {
    // Rebuild ASS from edited timestamps
    state.subtitlesASS = buildSubtitles(state.editedTimestamps);

    // Clear edit highlights
    document.querySelectorAll('.editor-row.edited').forEach(r => r.classList.remove('edited'));

    Toast.show('Subtitle timings updated & applied!', 'success');

    // Flash the phone mockup
    const phone = document.getElementById('phoneMockup');
    if (phone) {
        phone.style.boxShadow = '0 0 40px rgba(0,204,136,0.8)';
        setTimeout(() => { phone.style.boxShadow = ''; }, 600);
    }
}

function resetTimestamps() {
    if (!confirm('Reset all edits back to original timestamps?')) return;
    state.editedTimestamps = JSON.parse(JSON.stringify(state.wordTimestamps));
    renderWordEditor();
    renderPhoneSubtitle(previewAudioEl ? previewAudioEl.currentTime : 0);
    Toast.show('Timestamps reset to original', 'info');
}

// ========== VIDEO GENERATION ==========
async function generateVideo() {
    if (!state.audioBase64 || !state.subtitlesASS || !state.selectedVideo) {
        Toast.show('Please complete all previous steps', 'error');
        return;
    }
    if (state.audioBase64.length < 100) { Toast.show('Audio data invalid', 'error'); return; }
    if (!state.audioDuration || state.audioDuration < 1) { Toast.show('Invalid audio duration', 'error'); return; }

    const generateBtn   = document.getElementById('generateVideoBtn');
    const statusMessage = document.getElementById('statusMessage');
    const progressFill  = document.getElementById('progressFill');
    const progressPct   = document.getElementById('progressPercent');
    const progressTxt   = document.getElementById('progressText');

    if (generateBtn) { generateBtn.disabled = true; generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }
    if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-robot"></i> Initializing ArchNemix AI Pipeline...`;
    if (progressFill) progressFill.style.width = '0%';
    if (progressPct)  progressPct.textContent = '0%';
    if (progressTxt)  progressTxt.textContent  = 'Starting generation…';
    state.isProcessing = true;

    try {
        const resp = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-APP-KEY': APP_KEY },
            body: JSON.stringify({
                audio_base64:   state.audioBase64,
                subtitles_ass:  state.subtitlesASS,
                background:     state.selectedVideo,
                duration:       state.audioDuration,
                request_id:     `archnemix_${Date.now()}`,
            }),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`API ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        state.currentJobId = data.job_id;
        if (statusMessage) statusMessage.innerHTML = `
            <i class="fas fa-check-circle" style="color:var(--success)"></i>
            <strong>Job Started:</strong> ${state.currentJobId.substring(0, 8)}…
            <br><small>Estimated: ${data.estimated_time || 30}s</small>
        `;
        startJobPolling();
        Toast.show('Video generation started!', 'success');

    } catch (error) {
        console.error('Generate video failed:', error);
        let msg = error.message.includes('Rate limit') ? 'Rate limit exceeded (3/hour)' : error.message;
        if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-exclamation-circle" style="color:var(--error)"></i> <strong>Error:</strong> ${msg}`;
        if (generateBtn) { generateBtn.disabled = false; generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Try Again'; }
        state.isProcessing = false;
        Toast.show(msg, 'error');
    }
}

function startJobPolling() {
    if (state.jobPollInterval) clearInterval(state.jobPollInterval);
    state.jobPollInterval = setInterval(async () => {
        if (!state.currentJobId) { clearInterval(state.jobPollInterval); return; }
        try {
            const resp = await fetch(`${API_URL}/job/${state.currentJobId}`);
            if (!resp.ok) {
                if (resp.status === 404) { clearInterval(state.jobPollInterval); updateJobStatus({ status: 'failed', error: 'Job not found — may have expired' }); }
                return;
            }
            updateJobStatus(await resp.json());
        } catch (e) { console.warn('Poll error:', e); }
    }, 3000);
}

function updateJobStatus(data) {
    const fill  = document.getElementById('progressFill');
    const pct   = document.getElementById('progressPercent');
    const txt   = document.getElementById('progressText');
    const msg   = document.getElementById('statusMessage');
    const res   = document.getElementById('resultSection');
    const btn   = document.getElementById('generateVideoBtn');

    if (data.status === 'processing' || data.status === 'pending') {
        const p = data.progress || 0;
        if (fill) fill.style.width = `${p}%`;
        if (pct)  pct.textContent  = `${p}%`;
        if (txt)  txt.textContent  = data.message || 'Processing…';
        if (msg)  msg.innerHTML    = `<i class="fas fa-spinner fa-spin"></i> <strong>Processing:</strong> ${data.message || 'Generating…'}`;

    } else if (data.status === 'completed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (fill) fill.style.width = '100%';
        if (pct)  pct.textContent  = '100%';
        if (txt)  txt.textContent  = 'Completed!';
        if (msg) { msg.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> <strong>Success!</strong> Your short is ready!`; msg.className = 'status-message status-success'; }

        const resultVideo = document.getElementById('resultVideo');
        const dlBtn       = document.getElementById('downloadBtn');
        if (resultVideo) resultVideo.src = `${API_URL}/download/${state.currentJobId}`;
        if (dlBtn) { dlBtn.href = `${API_URL}/download/${state.currentJobId}`; dlBtn.download = `archnemix-${state.currentJobId.substring(0,8)}.mp4`; }
        if (res) { res.style.display = 'block'; res.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        if (btn) btn.style.display = 'none';
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success', 5000);

    } else if (data.status === 'failed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (fill) fill.style.width = '0%';
        if (pct)  pct.textContent  = '0%';
        if (txt)  txt.textContent  = 'Failed';
        if (msg) { msg.innerHTML = `<i class="fas fa-exclamation-circle" style="color:var(--error)"></i> <strong>Failed:</strong> ${data.error || 'Unknown error'}`; msg.className = 'status-message status-error'; }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Try Again'; btn.style.display = 'block'; }
        state.isProcessing = false;
        Toast.show('Video generation failed', 'error', 5000);
    }
}

function resetApplication() {
    if (state.jobPollInterval) { clearInterval(state.jobPollInterval); state.jobPollInterval = null; }
    stopPreview();
    Object.assign(state, {
        audioBlob: null, audioDuration: 0, subtitlesASS: "", selectedVideo: "mc1",
        currentJobId: "", audioBase64: "", script: "", isProcessing: false,
        wordTimestamps: [], editedTimestamps: []
    });

    const reset = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };
    reset('scriptInput', 'value', '');
    reset('charCount', 'textContent', '0');
    reset('charCounter', 'className', 'char-counter');
    reset('audioPreview', 'src', '');
    reset('audioStatus', 'innerHTML', '<i class="fas fa-info-circle"></i> Click "Generate Audio" to generate with exact timestamps');
    reset('audioStatus', 'className', 'status-message');
    reset('resultSection', 'style.display', 'none');
    reset('progressFill', 'style.width', '0%');
    reset('progressPercent', 'textContent', '0%');
    reset('progressText', 'textContent', 'Ready to generate');
    reset('statusMessage', 'innerHTML', '<i class="fas fa-info-circle"></i> Click "Generate Now" to start');
    reset('statusMessage', 'className', 'status-message');

    document.querySelectorAll('.video-card').forEach(c => c.classList.remove('selected'));

    const btn = document.getElementById('generateVideoBtn');
    if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Generate Now'; }

    goToStep(1);
    const first = document.querySelector('.video-card');
    if (first) setTimeout(() => first.click(), 100);
    Toast.show('Ready for new creation', 'info');
}

// ========== DEBUG UTILITIES ==========
window.debugState = () => {
    console.log('🔍 ArchNemix State:', {
        scriptLength:      state.script.length,
        audioDuration:     state.audioDuration,
        audioSize:         state.audioBase64.length,
        subsSize:          state.subtitlesASS.length,
        selectedVideo:     state.selectedVideo,
        currentJob:        state.currentJobId,
        isProcessing:      state.isProcessing,
        wordTimestamps:    state.wordTimestamps.length,
        editedTimestamps:  state.editedTimestamps.length,
        ttsEngine:         'Kokoro-82M ONNX Timestamped',
        timestampRes:      '~12.5ms (exact from pred_dur)',
    });
    return state;
};

window.testTTS = async (text = "Hello, this is a test of Kokoro ONNX timestamped.") => {
    try {
        const resp = await fetch(`${TTS_API}/tts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors',
            body: JSON.stringify({ text, voice: 'male_high', rate: 1.0 }),
        });
        const data = await resp.json();
        console.log(`✅ TTS: ${data.duration}s, ${data.word_timestamps?.length} words`);
        console.log('Timestamp source:', data.timestamp_source);
        console.log('Resolution ms:', data.timestamp_res_ms);
        console.log('First 5 words:', data.word_timestamps?.slice(0, 5));
        new Audio('data:audio/wav;base64,' + data.audio_base64).play();
        return data;
    } catch (err) { console.error('TTS test failed:', err); }
};

console.log('🚀 ArchNemix Shorts Generator v3.1');
console.log('🎯 TTS: Kokoro-82M ONNX Timestamped (~12.5ms exact timestamps)');
console.log('🎬 New: Subtitle Preview + Timestamp Editor');
console.log('📝 Debug: debugState() | testTTS()');
