// ArchNemix Shorts Generator - Kokoro-82M ONNX Line-based Subtitle Editor
// ============================================================================

// ========== CONFIGURATION ==========
const API_URL = "https://ytshortmakerarchx-ytshrt-archx-mc-1.hf.space";
const TTS_API = "https://ytshortmakerarchx-headtts-service.hf.space";
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
    wordTimestamps: [],
    subtitleLines: [],      // [{words: [...], start, end}]
    editedLines: [],        // user-edited copy
    previewAudio: null,
};

// ========== TOAST ==========
class Toast {
    static show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const icon = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
        toast.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.2em">${icon}</span><span>${message}</span></div>`;
        const colors = { success: '#00CC88', error: '#FF5555', warning: '#FFAA00', info: '#0066FF' };
        Object.assign(toast.style, {
            position:'fixed', top:'100px', right:'20px', padding:'12px 20px',
            background: colors[type], color:'white', borderRadius:'8px', fontWeight:'500',
            zIndex:'9999', boxShadow:'0 4px 12px rgba(0,0,0,0.2)', maxWidth:'300px',
            animation:'toastSlideIn 0.3s ease'
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

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
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
    if (rateSlider) rateSlider.addEventListener('input', (e) => {
        document.getElementById('rateValue').textContent = e.target.value;
    });

    const navMap = [
        ['nextStep1',           () => goToStep(2)],
        ['prevStep2',           () => goToStep(1)],
        ['nextStep2',           () => goToStep(2.5)],
        ['prevStep2_5',         () => goToStep(2)],
        ['applyLineEdits',      applyLineEdits],
        ['nextStep2_5',         () => goToStep(3)],
        ['prevStep3',           () => goToStep(2.5)],
        ['nextStep3',           () => goToStep(4)],
        ['prevStep4',           () => goToStep(3)],
        ['generateAudioBtn',    generateAudio],
        ['generateVideoBtn',    generateVideo],
        ['newVideoBtn',         resetApplication],
        ['resetLines',          resetLines],
        ['addLineBtn',          addNewLine],
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
    if (count > 3000 && count <= 3300) { if (charCounter) charCounter.classList.add('warning'); }
    else if (count > 3300) { if (charCounter) charCounter.classList.add('error'); }
    if (nextBtn) nextBtn.disabled = count < 10;
}

const STEP_IDS = [1, 2, 2.5, 3, 4];

function goToStep(step) {
    state.currentStep = step;
    if (step !== 2.5) stopPreview();
    updateStepIndicators();
    updateStepContent();
    if (step === 4) updateGenerationInfo();
    if (step === 2.5) initLineEditor();
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

// ========== VOICES ==========
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
        if (voices.length > 0) { applyVoices(voices); Toast.show(`${voices.length} voices loaded`, 'success'); }
        else throw new Error('No voices returned');
    } catch (err) {
        applyVoices(fallbackVoices);
        Toast.show('Using default voices', 'warning');
    }
}

// ========== VIDEOS ==========
async function loadVideos() {
    try {
        const resp = await fetch(`${API_URL}/videos/minecraft`);
        if (resp.ok) { const data = await resp.json(); renderVideoGrid(data.videos); Toast.show(`Loaded ${data.videos.length} videos`, 'success'); return; }
    } catch (e) { console.warn('Video API unavailable'); }
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
                <i class="fas fa-gamepad" style="color:${color}; font-size:2.5rem;"></i>
            </div>
            <div style="font-weight:600; margin-top:0.5rem;">${displayName}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Minecraft Adventure</div>
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
    if (!state.script.trim()) { Toast.show('Please enter a script first', 'error'); return; }
    const voiceId = document.getElementById('voiceSelect')?.value;
    const rate    = parseFloat(document.getElementById('rateSlider')?.value || '1.0');
    if (!voiceId) { Toast.show('Please select a voice', 'error'); return; }

    const audioStatus  = document.getElementById('audioStatus');
    const audioBtn     = document.getElementById('generateAudioBtn');
    const audioPreview = document.getElementById('audioPreview');
    const nextBtn      = document.getElementById('nextStep2');
    const prevBtn      = document.getElementById('prevStep2');

    const setStatus = (html, cls = 'status-message') => {
        if (audioStatus) { audioStatus.innerHTML = html; audioStatus.className = cls; }
    };

    setStatus(`<i class="fas fa-robot"></i> Generating audio with Kokoro-82M...`);
    if (audioBtn) { audioBtn.disabled = true; audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; }
    if (audioPreview) audioPreview.src = '';
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;

    try {
        await generateKokoroAudio(state.script, voiceId, rate);

        // Build lines from word timestamps
        state.subtitleLines = buildLinesFromWords(state.wordTimestamps);
        state.editedLines   = JSON.parse(JSON.stringify(state.subtitleLines));

        // Build ASS from lines
        state.subtitlesASS = buildSubtitlesFromLines(state.editedLines);

        setStatus(
            `<i class="fas fa-check-circle" style="color:var(--success)"></i>
             Audio ready! ${state.audioDuration.toFixed(1)}s · ${state.subtitleLines.length} subtitle lines`,
            'status-message status-success'
        );
        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = false;
        if (audioBtn) { audioBtn.disabled = false; audioBtn.innerHTML = '<i class="fas fa-play"></i> Regenerate Audio'; }
        Toast.show(`Audio ready — ${state.subtitleLines.length} lines to review`, 'success');

    } catch (error) {
        console.error('Generation failed:', error);
        setStatus(`<i class="fas fa-exclamation-circle" style="color:var(--error)"></i> ${error.message}`, 'status-message status-error');
        if (audioBtn) { audioBtn.disabled = false; audioBtn.innerHTML = '<i class="fas fa-play"></i> Generate Audio'; }
        if (prevBtn) prevBtn.disabled = false;
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
    state.wordTimestamps = data.word_timestamps || [];
    state.audioDuration  = data.duration;
    state.audioBase64    = data.audio_base64;

    const bytes = atob(data.audio_base64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    state.audioBlob = new Blob([buf], { type: 'audio/wav' });

    const preview = document.getElementById('audioPreview');
    if (preview) preview.src = URL.createObjectURL(state.audioBlob);
    return data;
}

// ========== LINE BUILDING ==========
// Group words into subtitle lines (3-4 words per line, break on punctuation)
function buildLinesFromWords(wordTimestamps) {
    if (!wordTimestamps || wordTimestamps.length === 0) return [];
    const TARGET = 3, MAX = 4;
    const groups = [];
    let current = [];

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

    // Convert groups → lines with start/end derived from word timestamps
    return groups.map(words => ({
        words: words.map(w => w.word || ''),
        start: parseFloat(words[0].start.toFixed(3)),
        end:   parseFloat(words[words.length - 1].end.toFixed(3)),
    }));
}

// ========== ASS SUBTITLE BUILD FROM LINES ==========
const SUBTITLE_LEAD_S = 0.10;

function buildSubtitlesFromLines(lines) {
    if (!lines || lines.length === 0) return '';

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

    const assLines = [];

    for (const line of lines) {
        if (!line.words || line.words.length === 0) continue;
        const lineStart = Math.max(0, line.start - SUBTITLE_LEAD_S);
        const lineEnd   = Math.max(lineStart + 0.05, line.end - SUBTITLE_LEAD_S);
        const lineDuration = lineEnd - lineStart;
        const wordDuration = lineDuration / line.words.length;

        const cleanWords = line.words.map(w => (w || '').replace(/[{}\\]/g, ''));
        const half = Math.ceil(cleanWords.length / 2);

        // One ASS event per word within the line (word highlighted in sequence)
        for (let i = 0; i < cleanWords.length; i++) {
            const wStart = lineStart + i * wordDuration;
            const wEnd   = lineStart + (i + 1) * wordDuration;

            const parts = cleanWords.map((word, j) =>
                j === i ? `${YELLOW}${word}${RESET}` : `${WHITE}${word}${RESET}`
            );
            const line1 = parts.slice(0, half).join(' ');
            const line2 = parts.slice(half).join(' ');
            const assText = line1 + (line2 ? '\\N' + line2 : '');

            assLines.push(
                `Dialogue: 1,${formatASSTime(wStart)},${formatASSTime(wEnd)},GroupSub,,0,0,0,,${assText}`
            );
        }
    }

    return header + '\n' + assLines.join('\n') + '\n';
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

// ========== LINE EDITOR + PREVIEW ==========

let previewAudioEl = null;
let isPreviewPlaying = false;

function initLineEditor() {
    renderLineEditor();
    setupPreviewAudio();
    renderPhoneSubtitle(0);
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; playBtn.dataset.playing = '0'; }
}

function setupPreviewAudio() {
    if (!state.audioBlob) return;
    if (previewAudioEl) { previewAudioEl.pause(); previewAudioEl.src = ''; }
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
    isPreviewPlaying = false;
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview'; }
    renderPhoneSubtitle(0);
    updateTimeDisplay(0);
}

function togglePreviewPlay() {
    if (!previewAudioEl) setupPreviewAudio();
    const playBtn = document.getElementById('previewPlayBtn');
    if (isPreviewPlaying) {
        previewAudioEl.pause();
        isPreviewPlaying = false;
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview';
    } else {
        previewAudioEl.play().catch(e => console.error(e));
        isPreviewPlaying = true;
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
    }
}

function updateTimeDisplay(t) {
    const el = document.getElementById('previewTimeDisplay');
    if (el) el.textContent = `${t.toFixed(2)}s / ${state.audioDuration.toFixed(2)}s`;
}

// Render phone subtitle at current time, using editedLines
function renderPhoneSubtitle(currentTime) {
    const subContainer = document.getElementById('phoneSubtitleDisplay');
    if (!subContainer) return;

    const lines = state.editedLines;
    if (!lines || lines.length === 0) { subContainer.innerHTML = ''; return; }

    // Find which line is active
    let activeLine = null;
    let activeWordIdx = -1;

    for (const line of lines) {
        const lStart = Math.max(0, line.start - SUBTITLE_LEAD_S);
        const lEnd   = Math.max(lStart + 0.05, line.end - SUBTITLE_LEAD_S);
        if (currentTime >= lStart && currentTime < lEnd) {
            activeLine = line;
            // Which word within this line?
            const lineDuration = lEnd - lStart;
            const progress = (currentTime - lStart) / lineDuration;
            activeWordIdx = Math.min(
                Math.floor(progress * line.words.length),
                line.words.length - 1
            );
            break;
        }
    }

    if (!activeLine) { subContainer.innerHTML = ''; return; }

    const cleanWords = activeLine.words.map(w => (w || '').replace(/[{}\\]/g, ''));
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

// ========== LINE EDITOR RENDER ==========

function renderLineEditor() {
    const container = document.getElementById('lineEditor');
    if (!container) return;

    const lines = state.editedLines;
    if (!lines || lines.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">No lines available. Generate audio first.</p>';
        return;
    }

    // Summary bar
    const totalLines = lines.length;
    document.getElementById('lineSummary').textContent = `${totalLines} subtitle line${totalLines !== 1 ? 's' : ''} · ${state.audioDuration.toFixed(1)}s total`;

    let html = `
        <div class="line-editor-header">
            <span class="lec-num">#</span>
            <span class="lec-words">Subtitle Text</span>
            <span class="lec-time">Start (s)</span>
            <span class="lec-time">End (s)</span>
            <span class="lec-dur">Duration</span>
            <span class="lec-actions">Actions</span>
        </div>
        <div class="line-editor-rows" id="lineEditorRows">
    `;

    lines.forEach((line, idx) => {
        html += renderLineRow(line, idx);
    });

    html += `</div>`;
    container.innerHTML = html;

    bindLineEditorEvents();
}

function renderLineRow(line, idx) {
    const dur = (line.end - line.start).toFixed(2);
    const wordsText = line.words.join(' ');
    return `
        <div class="line-editor-row" id="linerow-${idx}" data-idx="${idx}">
            <span class="lec-num le-num-badge">${idx + 1}</span>
            <div class="lec-words">
                <div class="le-words-display" id="le-display-${idx}" onclick="startEditWords(${idx})">${escapeHTML(wordsText)}</div>
                <input type="text" class="le-words-input" id="le-words-${idx}"
                    value="${escapeHTML(wordsText)}"
                    data-idx="${idx}"
                    style="display:none"
                    placeholder="Type subtitle text...">
            </div>
            <div class="lec-time">
                <input type="number" class="le-time-input le-start"
                    id="le-start-${idx}" data-idx="${idx}"
                    value="${line.start.toFixed(3)}" min="0" step="0.05">
            </div>
            <div class="lec-time">
                <input type="number" class="le-time-input le-end"
                    id="le-end-${idx}" data-idx="${idx}"
                    value="${line.end.toFixed(3)}" min="0" step="0.05">
            </div>
            <span class="lec-dur le-dur-display" id="le-dur-${idx}">${dur}s</span>
            <div class="lec-actions le-actions">
                <button class="le-btn le-btn-play" onclick="previewLine(${idx})" title="Preview this line">
                    <i class="fas fa-play"></i>
                </button>
                <button class="le-btn le-btn-split" onclick="splitLine(${idx})" title="Split line into two">
                    <i class="fas fa-cut"></i>
                </button>
                <button class="le-btn le-btn-merge" onclick="mergeLine(${idx})" title="Merge with next line" ${idx >= state.editedLines.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-compress-alt"></i>
                </button>
                <button class="le-btn le-btn-delete" onclick="deleteLine(${idx})" title="Delete line">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function bindLineEditorEvents() {
    // Time inputs
    document.querySelectorAll('.le-start, .le-end').forEach(input => {
        input.addEventListener('change', handleLineTimeChange);
        input.addEventListener('input',  handleLineTimeChange);
    });
    // Word inputs — save on blur or Enter
    document.querySelectorAll('.le-words-input').forEach(input => {
        input.addEventListener('blur',  saveWordEdit);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); } });
    });
}

function handleLineTimeChange(e) {
    const idx = parseInt(e.target.dataset.idx);
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) return;
    if (e.target.classList.contains('le-start')) {
        state.editedLines[idx].start = val;
    } else {
        state.editedLines[idx].end = val;
    }
    const line = state.editedLines[idx];
    const durEl = document.getElementById(`le-dur-${idx}`);
    if (durEl) durEl.textContent = `${(line.end - line.start).toFixed(2)}s`;
    const row = document.getElementById(`linerow-${idx}`);
    if (row) row.classList.add('le-edited');
}

function startEditWords(idx) {
    const display = document.getElementById(`le-display-${idx}`);
    const input   = document.getElementById(`le-words-${idx}`);
    if (!display || !input) return;
    display.style.display = 'none';
    input.style.display   = 'block';
    input.focus();
    input.select();
}

function saveWordEdit(e) {
    const idx = parseInt(e.target.dataset.idx);
    const newWords = e.target.value.trim().split(/\s+/).filter(Boolean);
    if (newWords.length === 0) return;
    state.editedLines[idx].words = newWords;
    const display = document.getElementById(`le-display-${idx}`);
    if (display) {
        display.textContent = newWords.join(' ');
        display.style.display = 'block';
    }
    e.target.style.display = 'none';
    const row = document.getElementById(`linerow-${idx}`);
    if (row) row.classList.add('le-edited');
}

// ========== LINE OPERATIONS ==========

function previewLine(idx) {
    if (!previewAudioEl) setupPreviewAudio();
    const line = state.editedLines[idx];
    if (!line) return;
    previewAudioEl.pause();
    isPreviewPlaying = false;
    const playBtn = document.getElementById('previewPlayBtn');
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> Play Preview';
    previewAudioEl.currentTime = Math.max(0, line.start);
    previewAudioEl.play().catch(() => {});
    setTimeout(() => { previewAudioEl.pause(); }, (line.end - line.start + 0.3) * 1000);
    renderPhoneSubtitle(line.start + 0.01);
    // Highlight row
    const row = document.getElementById(`linerow-${idx}`);
    if (row) {
        row.classList.add('le-auditioned');
        setTimeout(() => row.classList.remove('le-auditioned'), 1200);
    }
}

function splitLine(idx) {
    const line = state.editedLines[idx];
    if (!line || line.words.length < 2) {
        Toast.show('Need at least 2 words to split', 'warning');
        return;
    }
    const mid  = Math.ceil(line.words.length / 2);
    const mid_t = line.start + (line.end - line.start) * (mid / line.words.length);

    const lineA = { words: line.words.slice(0, mid), start: line.start, end: parseFloat(mid_t.toFixed(3)) };
    const lineB = { words: line.words.slice(mid),    start: parseFloat(mid_t.toFixed(3)), end: line.end };

    state.editedLines.splice(idx, 1, lineA, lineB);
    renderLineEditor();
    Toast.show('Line split in two', 'success');
}

function mergeLine(idx) {
    if (idx >= state.editedLines.length - 1) return;
    const lineA = state.editedLines[idx];
    const lineB = state.editedLines[idx + 1];
    const merged = {
        words: [...lineA.words, ...lineB.words],
        start: lineA.start,
        end:   lineB.end,
    };
    state.editedLines.splice(idx, 2, merged);
    renderLineEditor();
    Toast.show('Lines merged', 'success');
}

function deleteLine(idx) {
    if (state.editedLines.length <= 1) { Toast.show('Cannot delete the last line', 'warning'); return; }
    state.editedLines.splice(idx, 1);
    renderLineEditor();
    Toast.show('Line deleted', 'info');
}

function addNewLine() {
    const lastLine = state.editedLines[state.editedLines.length - 1];
    const start = lastLine ? lastLine.end + 0.1 : 0;
    const end   = start + 1.5;
    state.editedLines.push({ words: ['New', 'text'], start, end });
    renderLineEditor();
    // Scroll to bottom
    const scroll = document.querySelector('.line-editor-scroll');
    if (scroll) setTimeout(() => { scroll.scrollTop = scroll.scrollHeight; }, 50);
    Toast.show('New line added at end', 'success');
}

function resetLines() {
    if (!confirm('Reset all edits back to original auto-generated lines?')) return;
    state.editedLines = JSON.parse(JSON.stringify(state.subtitleLines));
    renderLineEditor();
    renderPhoneSubtitle(previewAudioEl ? previewAudioEl.currentTime : 0);
    Toast.show('Lines reset to original', 'info');
}

function applyLineEdits() {
    state.subtitlesASS = buildSubtitlesFromLines(state.editedLines);
    document.querySelectorAll('.line-editor-row.le-edited').forEach(r => r.classList.remove('le-edited'));

    const phone = document.getElementById('phoneMockup');
    if (phone) {
        phone.style.boxShadow = '0 0 40px rgba(0,204,136,0.8)';
        setTimeout(() => { phone.style.boxShadow = ''; }, 600);
    }
    Toast.show(`${state.editedLines.length} lines applied to subtitle file!`, 'success');
}

// ========== VIDEO GENERATION ==========
async function generateVideo() {
    if (!state.audioBase64 || !state.subtitlesASS || !state.selectedVideo) {
        Toast.show('Please complete all previous steps', 'error'); return;
    }
    const generateBtn   = document.getElementById('generateVideoBtn');
    const statusMessage = document.getElementById('statusMessage');
    const progressFill  = document.getElementById('progressFill');
    const progressPct   = document.getElementById('progressPercent');
    const progressTxt   = document.getElementById('progressText');

    if (generateBtn) { generateBtn.disabled = true; generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }
    if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-robot"></i> Initializing ArchNemix AI Pipeline...`;
    if (progressFill) progressFill.style.width = '0%';
    state.isProcessing = true;

    try {
        const resp = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-APP-KEY': APP_KEY },
            body: JSON.stringify({
                audio_base64:  state.audioBase64,
                subtitles_ass: state.subtitlesASS,
                background:    state.selectedVideo,
                duration:      state.audioDuration,
                request_id:    `archnemix_${Date.now()}`,
            }),
        });
        if (!resp.ok) { const t = await resp.text(); throw new Error(`API ${resp.status}: ${t}`); }
        const data = await resp.json();
        state.currentJobId = data.job_id;
        if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> <strong>Job Started:</strong> ${state.currentJobId.substring(0,8)}…`;
        startJobPolling();
        Toast.show('Video generation started!', 'success');
    } catch (error) {
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
                if (resp.status === 404) { clearInterval(state.jobPollInterval); updateJobStatus({ status:'failed', error:'Job not found' }); }
                return;
            }
            updateJobStatus(await resp.json());
        } catch (e) { console.warn('Poll error:', e); }
    }, 3000);
}

function updateJobStatus(data) {
    const fill = document.getElementById('progressFill');
    const pct  = document.getElementById('progressPercent');
    const txt  = document.getElementById('progressText');
    const msg  = document.getElementById('statusMessage');
    const res  = document.getElementById('resultSection');
    const btn  = document.getElementById('generateVideoBtn');

    if (data.status === 'processing' || data.status === 'pending') {
        const p = data.progress || 0;
        if (fill) fill.style.width = `${p}%`;
        if (pct)  pct.textContent = `${p}%`;
        if (txt)  txt.textContent = data.message || 'Processing…';
        if (msg)  msg.innerHTML   = `<i class="fas fa-spinner fa-spin"></i> <strong>Processing:</strong> ${data.message || 'Generating…'}`;
    } else if (data.status === 'completed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (fill) fill.style.width = '100%';
        if (pct)  pct.textContent  = '100%';
        if (txt)  txt.textContent  = 'Completed!';
        if (msg)  { msg.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> <strong>Success!</strong>`; msg.className = 'status-message status-success'; }
        const resultVideo = document.getElementById('resultVideo');
        const dlBtn = document.getElementById('downloadBtn');
        if (resultVideo) resultVideo.src = `${API_URL}/download/${state.currentJobId}`;
        if (dlBtn) { dlBtn.href = `${API_URL}/download/${state.currentJobId}`; dlBtn.download = `archnemix-${state.currentJobId.substring(0,8)}.mp4`; }
        if (res) { res.style.display = 'block'; res.scrollIntoView({ behavior:'smooth', block:'center' }); }
        if (btn) btn.style.display = 'none';
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success', 5000);
    } else if (data.status === 'failed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (msg) { msg.innerHTML = `<i class="fas fa-exclamation-circle" style="color:var(--error)"></i> <strong>Failed:</strong> ${data.error || 'Unknown'}`; msg.className = 'status-message status-error'; }
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
        wordTimestamps: [], subtitleLines: [], editedLines: []
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

function escapeHTML(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.debugState = () => console.log('State:', state);
console.log('🚀 ArchNemix Shorts Generator v4.0 — Line-based Subtitle Editor');
