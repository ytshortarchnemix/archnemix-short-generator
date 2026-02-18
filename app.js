// ArchNemix Shorts Generator — Waveform Subtitle Editor Edition
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
    subtitleLines: [],   // [{words:[...], start, end}]
    editedLines: [],
};

// ========== TOAST ==========
class Toast {
    static show(message, type = 'info', duration = 3000) {
        const area = document.getElementById('wedToastArea') || (() => {
            const d = document.createElement('div');
            d.id = 'wedToastArea';
            Object.assign(d.style, {
                position:'fixed', top:'70px', right:'16px', zIndex:'9998',
                display:'flex', flexDirection:'column', gap:'0.4rem'
            });
            document.body.appendChild(d);
            return d;
        })();

        const icons = { success:'circle-check', error:'circle-xmark', warning:'triangle-exclamation', info:'circle-info' };
        const colors = { success:'#10B981', error:'#EF4444', warning:'#F59E0B', info:'#3B82F6' };
        const t = document.createElement('div');
        Object.assign(t.style, {
            background:'#0F1525', border:`1px solid rgba(255,255,255,0.08)`,
            borderLeft:`3px solid ${colors[type] || colors.info}`,
            borderRadius:'8px', padding:'0.6rem 1rem',
            fontFamily:"'Outfit', sans-serif", fontSize:'0.8rem',
            color:'#E0E6F0', display:'flex', alignItems:'center', gap:'0.5rem',
            boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxWidth:'280px',
            animation:'toastIn 0.25s ease',
        });
        t.innerHTML = `<i class="fas fa-${icons[type] || 'circle-info'}" style="color:${colors[type] || colors.info};font-size:0.75rem;flex-shrink:0"></i> ${message}`;
        area.appendChild(t);
        setTimeout(() => {
            t.style.animation = 'toastOut 0.25s ease forwards';
            setTimeout(() => t.remove(), 280);
        }, duration);
    }
}

// Inject toast keyframes
const _ts = document.createElement('style');
_ts.textContent = `
  @keyframes toastIn  { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastOut { from{opacity:1} to{opacity:0;transform:translateX(14px)} }
`;
document.head.appendChild(_ts);

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
        Toast.show('ArchNemix ready — Kokoro-82M ONNX loaded', 'success');
    } catch (error) {
        console.error('Init error:', error);
        Toast.show('Initialization error', 'error');
    }
}

function setupEventListeners() {
    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput) scriptInput.addEventListener('input', handleScriptInput);

    const rateSlider = document.getElementById('rateSlider');
    if (rateSlider) rateSlider.addEventListener('input', e => {
        document.getElementById('rateValue').textContent = e.target.value;
    });

    const navMap = [
        ['nextStep1',       () => goToStep(2)],
        ['prevStep2',       () => goToStep(1)],
        ['nextStep2',       () => goToStep(2.5)],
        ['prevStep2_5',     () => goToStep(2)],
        ['nextStep2_5',     () => goToStep(3)],
        ['prevStep3',       () => goToStep(2.5)],
        ['nextStep3',       () => goToStep(4)],
        ['prevStep4',       () => goToStep(3)],
        ['generateAudioBtn', generateAudio],
        ['generateVideoBtn', generateVideo],
        ['newVideoBtn',     resetApplication],
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
    const charCount   = document.getElementById('charCount');
    const nextBtn     = document.getElementById('nextStep1');
    if (charCount) charCount.textContent = count;
    if (charCounter) {
        charCounter.className = 'char-counter';
        if (count > 3000 && count <= 3300) charCounter.classList.add('warning');
        else if (count > 3300) charCounter.classList.add('error');
    }
    if (nextBtn) nextBtn.disabled = count < 10;
}

function goToStep(step) {
    state.currentStep = step;
    if (step !== 2.5) wedPauseAudio();
    updateStepIndicators();
    updateStepContent();
    if (step === 4)   updateGenerationInfo();
    if (step === 2.5) initWaveformEditor();
}

function updateStepIndicators() {
    document.querySelectorAll('.step-indicator').forEach(el => {
        const s = parseFloat(el.dataset.step);
        el.classList.toggle('active',    s === state.currentStep);
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
        { id: 'male_high',     name: 'Michael (US Male) — High Quality',  quality: 'high' },
        { id: 'male_medium',   name: 'Adam (US Male) — Clear',            quality: 'medium' },
        { id: 'female_high',   name: 'Sarah (US Female) — High Quality',  quality: 'high' },
        { id: 'female_medium', name: 'Sky (US Female) — Natural',         quality: 'medium' },
    ];
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    const applyVoices = voices => {
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
        else throw new Error('No voices');
    } catch (err) {
        applyVoices(fallbackVoices);
        Toast.show('Using default voices', 'warning');
    }
}

// ========== VIDEOS ==========
async function loadVideos() {
    try {
        const resp = await fetch(`${API_URL}/videos/minecraft`);
        if (resp.ok) {
            const data = await resp.json();
            renderVideoGrid(data.videos);
            Toast.show(`${data.videos.length} videos loaded`, 'success');
            return;
        }
    } catch (e) { console.warn('Video API unavailable'); }
    renderVideoGrid(['mc1','mc2','mc3','mc4','mc5','mc6']);
    Toast.show('Using fallback video library', 'warning');
}

function renderVideoGrid(videoList) {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const colors  = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4'];
    const icons   = ['🎮','⚔️','🏔️','🌊','🔥','⚡'];
    videoList.forEach((videoName, index) => {
        const item = document.createElement('div');
        item.className = 'video-card';
        item.dataset.video = videoName;
        const displayName = videoName.replace('.mp4','').toUpperCase();
        const color = colors[index % colors.length];
        const icon  = icons[index % icons.length];
        item.innerHTML = `
            <div class="video-thumb" style="background:linear-gradient(135deg,${color}18,${color}30);">
                <span style="font-size:2.2rem">${icon}</span>
            </div>
            <div class="video-card-name">${displayName}</div>
            <div class="video-card-sub">Minecraft Adventure</div>
        `;
        item.addEventListener('click', function() {
            document.querySelectorAll('.video-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            state.selectedVideo = videoName.replace('.mp4','');
            const nextBtn = document.getElementById('nextStep3');
            if (nextBtn) nextBtn.disabled = false;
            updateGenerationInfo();
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

    setStatus(`<i class="fas fa-circle-notch fa-spin"></i> Generating audio with Kokoro-82M…`);
    if (audioBtn) { audioBtn.disabled = true; audioBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…'; }
    if (audioPreview) audioPreview.src = '';
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;

    try {
        await generateKokoroAudio(state.script, voiceId, rate);
        state.subtitleLines = buildLinesFromWords(state.wordTimestamps);
        state.editedLines   = JSON.parse(JSON.stringify(state.subtitleLines));
        state.subtitlesASS  = buildSubtitlesFromLines(state.editedLines);

        // Feed audio buffer into the waveform editor if it's already open
        if (state.audioBlob) wedLoadAudioBlob(state.audioBlob);

        setStatus(
            `<i class="fas fa-circle-check" style="color:var(--green)"></i> Audio ready — ${state.audioDuration.toFixed(1)}s · ${state.subtitleLines.length} subtitle lines`,
            'status-message status-success'
        );
        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = false;
        if (audioBtn) { audioBtn.disabled = false; audioBtn.innerHTML = '<i class="fas fa-rotate-right"></i> Regenerate Audio'; }
        Toast.show(`Audio ready — ${state.subtitleLines.length} subtitle lines`, 'success');
    } catch (error) {
        console.error('Generation failed:', error);
        setStatus(`<i class="fas fa-circle-xmark" style="color:var(--red)"></i> ${error.message}`, 'status-message status-error');
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
    const buf   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    state.audioBlob = new Blob([buf], { type: 'audio/wav' });

    const preview = document.getElementById('audioPreview');
    if (preview) preview.src = URL.createObjectURL(state.audioBlob);
    return data;
}

// ========== LINE BUILDING ==========
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

    return groups.map(words => ({
        words: words.map(w => w.word || ''),
        start: parseFloat(words[0].start.toFixed(3)),
        end:   parseFloat(words[words.length - 1].end.toFixed(3)),
    }));
}

// ========== ASS SUBTITLE BUILD ==========
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
        const lineStart  = Math.max(0, line.start - SUBTITLE_LEAD_S);
        const lineEnd    = Math.max(lineStart + 0.05, line.end - SUBTITLE_LEAD_S);
        const lineDur    = lineEnd - lineStart;
        const wordDur    = lineDur / line.words.length;
        const cleanWords = line.words.map(w => (w || '').replace(/[{}\\]/g, ''));
        const half       = Math.ceil(cleanWords.length / 2);

        for (let i = 0; i < cleanWords.length; i++) {
            const wStart  = lineStart + i * wordDur;
            const wEnd    = lineStart + (i + 1) * wordDur;
            const parts   = cleanWords.map((word, j) =>
                j === i ? `${YELLOW}${word}${RESET}` : `${WHITE}${word}${RESET}`
            );
            const line1   = parts.slice(0, half).join(' ');
            const line2   = parts.slice(half).join(' ');
            const assText = line1 + (line2 ? '\\N' + line2 : '');
            assLines.push(`Dialogue: 1,${formatASSTime(wStart)},${formatASSTime(wEnd)},GroupSub,,0,0,0,,${assText}`);
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
    return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(cs).padStart(2,'00')}`;
}

function updateGenerationInfo() {
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('infoLength',     `${state.script.length} chars`);
    set('infoDuration',   `${Math.round(state.audioDuration * 10) / 10}s`);
    set('infoBackground', state.selectedVideo ? state.selectedVideo.toUpperCase() : '—');
    set('infoTime',       `~${Math.round(10 + state.audioDuration * 0.5)}s`);
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

    if (generateBtn) { generateBtn.disabled = true; generateBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing…'; }
    if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Initializing ArchNemix AI Pipeline…`;
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
        if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-circle-check" style="color:var(--green)"></i> Job started: ${state.currentJobId.substring(0,8)}…`;
        startJobPolling();
        Toast.show('Video generation started!', 'success');
    } catch (error) {
        let msg = error.message.includes('Rate limit') ? 'Rate limit exceeded (3/hour)' : error.message;
        if (statusMessage) statusMessage.innerHTML = `<i class="fas fa-circle-xmark" style="color:var(--red)"></i> ${msg}`;
        if (generateBtn) { generateBtn.disabled = false; generateBtn.innerHTML = '<i class="fas fa-rotate-right"></i> Try Again'; }
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
        if (pct)  pct.textContent  = `${p}%`;
        if (txt)  txt.textContent  = data.message || 'Processing…';
        if (msg)  msg.innerHTML    = `<i class="fas fa-circle-notch fa-spin"></i> ${data.message || 'Generating…'}`;
    } else if (data.status === 'completed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (fill) fill.style.width = '100%';
        if (pct)  pct.textContent  = '100%';
        if (txt)  txt.textContent  = 'Completed!';
        if (msg)  { msg.innerHTML = `<i class="fas fa-circle-check" style="color:var(--green)"></i> Video generated successfully!`; msg.className = 'status-message status-success'; }
        const resultVideo = document.getElementById('resultVideo');
        const dlBtn       = document.getElementById('downloadBtn');
        if (resultVideo) resultVideo.src = `${API_URL}/download/${state.currentJobId}`;
        if (dlBtn) { dlBtn.href = `${API_URL}/download/${state.currentJobId}`; dlBtn.download = `archnemix-${state.currentJobId.substring(0,8)}.mp4`; }
        if (res) { res.style.display = 'block'; res.scrollIntoView({ behavior:'smooth', block:'center' }); }
        if (btn) btn.style.display = 'none';
        state.isProcessing = false;
        Toast.show('Your ArchNemix short is ready!', 'success', 5000);
    } else if (data.status === 'failed') {
        clearInterval(state.jobPollInterval); state.jobPollInterval = null;
        if (msg) { msg.innerHTML = `<i class="fas fa-circle-xmark" style="color:var(--red)"></i> Failed: ${data.error || 'Unknown error'}`; msg.className = 'status-message status-error'; }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate-right"></i> Try Again'; btn.style.display = 'block'; }
        state.isProcessing = false;
        Toast.show('Video generation failed', 'error', 5000);
    }
}

function resetApplication() {
    if (state.jobPollInterval) { clearInterval(state.jobPollInterval); state.jobPollInterval = null; }
    wedPauseAudio();
    Object.assign(state, {
        audioBlob: null, audioDuration: 0, subtitlesASS: "",
        selectedVideo: "mc1", currentJobId: "", audioBase64: "",
        script: "", isProcessing: false,
        wordTimestamps: [], subtitleLines: [], editedLines: []
    });
    const reset = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };
    reset('scriptInput',   'value', '');
    reset('charCount',     'textContent', '0');
    reset('charCounter',   'className', 'char-counter');
    reset('audioPreview',  'src', '');
    reset('audioStatus',   'innerHTML', '<i class="fas fa-circle-info"></i> Click "Generate Audio" to create your voiceover with word-level timestamps.');
    reset('audioStatus',   'className', 'status-message');
    reset('resultSection', 'style.display', 'none');
    reset('progressFill',  'style.width', '0%');
    reset('progressPercent','textContent', '0%');
    reset('progressText',  'textContent', 'Ready to generate');
    reset('statusMessage', 'innerHTML', '<i class="fas fa-circle-info"></i> Click "Generate Now" to start.');
    reset('statusMessage', 'className', 'status-message');
    document.querySelectorAll('.video-card').forEach(c => c.classList.remove('selected'));
    const btn = document.getElementById('generateVideoBtn');
    if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Generate Now'; }
    // Reset waveform editor state
    wed.blocks = []; wed.selected = new Set(); wed.undoStack = []; wed.redoStack = [];
    wed.duration = 0; wed.currentTime = 0; wed.audioBuffer = null; wed.waveformData = null;
    goToStep(1);
    const first = document.querySelector('.video-card');
    if (first) setTimeout(() => first.click(), 100);
    Toast.show('Ready for a new creation', 'info');
}

// =============================================================================
// ██ WAVEFORM SUBTITLE EDITOR — fully integrated into step 2.5 ██
// =============================================================================

const wed = {
    // runtime state
    duration:    0,
    currentTime: 0,
    isPlaying:   false,
    zoom:        1,
    snap:        true,
    blocks:      [],   // [{id, start, end, words:[str], trackIdx}]
    selected:    new Set(),
    nextId:      1,
    audioBuffer: null,
    audioCtx:    null,
    audioSource: null,
    startedAt:   0,
    offsetAtStart: 0,
    waveformData: null,
    undoStack:   [],
    redoStack:   [],
    rafId:       null,
    initialized: false,
};

const WED_SNAP = 0.08;
const WED_MIN_DUR = 0.2;
const WED_PX_BASE = 100;
const WED_LEAD = 0.10;
const WED_WAVEFORM_H = 90;
const WED_TRACK_H = 44;
const WED_RULER_H = 28;

function wedPxPerSec() { return WED_PX_BASE * wed.zoom; }
function wedTimeToPx(t) { return t * wedPxPerSec(); }
function wedPxToTime(px) { return px / wedPxPerSec(); }
function wedTotalW() {
    const sc = document.getElementById('wedScroll');
    return Math.max(wedTimeToPx(wed.duration) + 200, sc ? sc.clientWidth : 600);
}
function wedSid() { return 'w' + (wed.nextId++); }

// ── INIT ──
function initWaveformEditor() {
    if (!wed.initialized) {
        _wedBindKeys();
        _wedBindCtx();
        wed.initialized = true;
    }

    // Load blocks from app state
    wed.duration = state.audioDuration || 18;
    wed.blocks   = state.editedLines.map(l => ({
        id:       wedSid(),
        start:    l.start,
        end:      l.end,
        words:    [...l.words],
        trackIdx: 0,
    }));
    wed.selected = new Set();
    wed.currentTime = 0;

    // Load audio from blob
    if (state.audioBlob) {
        wedLoadAudioBlob(state.audioBlob);
    } else {
        wed.waveformData = _wedFakeWaveform();
        _wedRender();
    }
    _wedRender();
    Toast.show(`Timeline loaded — ${wed.blocks.length} subtitle blocks`, 'info');
}

async function wedLoadAudioBlob(blob) {
    try {
        if (!wed.audioCtx) wed.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ab = await blob.arrayBuffer();
        wed.audioBuffer = await wed.audioCtx.decodeAudioData(ab);
        wed.duration    = wed.audioBuffer.duration;

        // Build waveform from channel data
        const raw = wed.audioBuffer.getChannelData(0);
        const N   = 2048;
        const wf  = new Float32Array(N);
        const step = Math.floor(raw.length / N);
        for (let i = 0; i < N; i++) {
            let mx = 0;
            for (let j = 0; j < step; j++) { const v = Math.abs(raw[i*step+j]||0); if(v>mx) mx=v; }
            wf[i] = mx;
        }
        wed.waveformData = wf;
        _wedRender();
    } catch (e) {
        console.warn('WED audio load error', e);
        wed.waveformData = _wedFakeWaveform();
        _wedRender();
    }
}

function _wedFakeWaveform() {
    const N = 2048;
    const wf = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        const t = i / N;
        wf[i] = (Math.random() * 0.8 + 0.1) * Math.sin(t * Math.PI);
    }
    return wf;
}

// ── RENDER ALL ──
function _wedRender() {
    _wedRenderRuler();
    _wedRenderWaveform();
    _wedRenderBlocks();
    _wedUpdatePlayhead();
}

// ── RULER ──
function _wedRenderRuler() {
    const canvas = document.getElementById('wedRuler');
    if (!canvas) return;
    const W = wedTotalW();
    canvas.width  = W;
    canvas.height = WED_RULER_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0A0E1A';
    ctx.fillRect(0, 0, W, WED_RULER_H);

    const pps  = wedPxPerSec();
    const step = _wedBestStep(pps);

    ctx.font = '500 9px Geist Mono, monospace';
    ctx.textBaseline = 'bottom';

    for (let t = 0; t <= wed.duration + step; t += step) {
        const x = wedTimeToPx(t);
        if (x > W) break;
        const major = (Math.round(t / step) % 5) === 0;
        ctx.fillStyle = major ? '#2A3548' : '#161E2D';
        ctx.fillRect(x, major ? WED_RULER_H * 0.25 : WED_RULER_H * 0.6, 1, WED_RULER_H);
        if (major) {
            ctx.fillStyle = '#4A5568';
            ctx.fillText(_wedFmtTime(t), x + 2, WED_RULER_H - 2);
        }
    }
    ctx.fillStyle = 'rgba(59,130,246,0.12)';
    ctx.fillRect(0, WED_RULER_H - 1, W, 1);
}

function _wedBestStep(pps) {
    for (const s of [0.05,0.1,0.25,0.5,1,2,5,10,30,60]) { if (pps * s >= 40) return s; }
    return 60;
}

// ── WAVEFORM ──
function _wedRenderWaveform() {
    const canvas = document.getElementById('wedWave');
    if (!canvas) return;
    const W = wedTotalW();
    canvas.width  = W;
    canvas.height = WED_WAVEFORM_H;
    const ca    = document.getElementById('wedCanvasArea');
    if (ca) ca.style.width = W + 'px';

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0F1525';
    ctx.fillRect(0, 0, W, WED_WAVEFORM_H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < WED_WAVEFORM_H; y += 22) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    const mid = WED_WAVEFORM_H / 2;
    ctx.strokeStyle = 'rgba(59,130,246,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0,mid); ctx.lineTo(W,mid); ctx.stroke();

    if (!wed.waveformData) return;
    const data = wed.waveformData;
    const grad = ctx.createLinearGradient(0, 0, 0, WED_WAVEFORM_H);
    grad.addColorStop(0,   'rgba(59,130,246,0.75)');
    grad.addColorStop(0.5, 'rgba(96,165,250,0.95)');
    grad.addColorStop(1,   'rgba(59,130,246,0.75)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const spp = data.length / W;
    for (let x = 0; x < W; x++) {
        const s = Math.floor(x * spp);
        const e = Math.floor((x+1) * spp);
        let mn=0, mx=0;
        for (let i=s; i<e && i<data.length; i++) {
            if(data[i]<mn) mn=data[i];
            if(data[i]>mx) mx=data[i];
        }
        ctx.moveTo(x, mid - mx * (mid - 5));
        ctx.lineTo(x, mid - mn * (mid - 5));
    }
    ctx.stroke();
}

// ── SUBTITLE BLOCKS ──
function _wedRenderBlocks() {
    const container = document.getElementById('wedSubTracks');
    const labelsCol = document.getElementById('wedSubLabels');
    if (!container || !labelsCol) return;
    container.innerHTML = '';
    labelsCol.innerHTML = '';

    const tracks = _wedUniqueTracks();
    if (tracks.length === 0) tracks.push(0);
    const W = wedTotalW();

    tracks.forEach(ti => {
        // Label
        const lbl = document.createElement('div');
        lbl.className = 'wed-label-cell wed-label-sub';
        lbl.style.height = WED_TRACK_H + 'px';
        lbl.textContent  = 'S' + (ti+1);
        labelsCol.appendChild(lbl);

        // Track
        const track = document.createElement('div');
        track.className   = 'wed-sub-track';
        track.style.width  = W + 'px';
        track.style.height = WED_TRACK_H + 'px';
        track.dataset.track = ti;

        track.addEventListener('mousedown', e => {
            if (e.target === track) {
                const rect = track.getBoundingClientRect();
                const sc   = document.getElementById('wedScroll');
                const x    = e.clientX - rect.left + (sc ? sc.scrollLeft : 0);
                wedSeekTo(wedPxToTime(x));
                wed.selected.clear();
                _wedUpdateBlockSel();
                _wedUpdateInspector();
            }
        });

        wed.blocks.filter(b => b.trackIdx === ti).forEach(block => {
            track.appendChild(_wedCreateBlockEl(block));
        });
        container.appendChild(track);
    });

    _wedUpdatePlayhead();
}

function _wedCreateBlockEl(block) {
    const el = document.createElement('div');
    el.className    = 'wed-block';
    el.dataset.id   = block.id;
    if (wed.selected.has(block.id)) el.classList.add('wed-selected');

    const hl = document.createElement('div'); hl.className = 'wed-handle wed-handle-l';
    const hr = document.createElement('div'); hr.className = 'wed-handle wed-handle-r';
    const tx = document.createElement('div'); tx.className = 'wed-block-text'; tx.textContent = block.words.join(' ');

    el.appendChild(hl);
    el.appendChild(tx);
    el.appendChild(hr);
    _wedPosBlock(el, block);

    // DRAG MOVE
    el.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target === hl || e.target === hr) return;
        e.stopPropagation(); e.preventDefault();
        if (!e.shiftKey) wed.selected.clear();
        wed.selected.add(block.id);
        _wedUpdateBlockSel();
        _wedUpdateInspector();

        const sx = e.clientX, os = block.start, oe = block.end;
        const dur = oe - os;
        const onM = ev => {
            const dt = wedPxToTime(ev.clientX - sx);
            let ns = Math.max(0, os + dt);
            if (wed.snap) { const sn = _wedSnap(ns, block.id); if(sn!==null) ns=sn; }
            block.start = +ns.toFixed(3);
            block.end   = +(ns + dur).toFixed(3);
            _wedPosBlock(el, block);
            _wedUpdateInspector();
        };
        const onU = () => { _wedSaveUndo(); document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); };
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    // RESIZE LEFT
    hl.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        const sx = e.clientX, os = block.start;
        const onM = ev => {
            const dt = wedPxToTime(ev.clientX - sx);
            let ns = Math.max(0, Math.min(block.end - WED_MIN_DUR, os + dt));
            if (wed.snap) { const sn = _wedSnap(ns, block.id); if(sn!==null) ns=sn; }
            block.start = +ns.toFixed(3);
            _wedPosBlock(el, block);
            _wedUpdateInspector();
        };
        const onU = () => { _wedSaveUndo(); document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); };
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    // RESIZE RIGHT
    hr.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        const sx = e.clientX, oe = block.end;
        const onM = ev => {
            const dt = wedPxToTime(ev.clientX - sx);
            let ne = Math.max(block.start + WED_MIN_DUR, oe + dt);
            if (wed.snap) { const sn = _wedSnap(ne, block.id); if(sn!==null) ne=sn; }
            block.end = +ne.toFixed(3);
            _wedPosBlock(el, block);
            _wedUpdateInspector();
        };
        const onU = () => { _wedSaveUndo(); document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); };
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    // DOUBLE CLICK — inline edit
    el.addEventListener('dblclick', e => {
        e.stopPropagation();
        _wedStartEdit(el, block, tx);
    });

    // RIGHT CLICK
    el.addEventListener('contextmenu', e => {
        e.preventDefault();
        wed.selected.clear();
        wed.selected.add(block.id);
        _wedUpdateBlockSel();
        _wedUpdateInspector();
        _wedShowCtx(e.clientX, e.clientY);
    });

    return el;
}

function _wedPosBlock(el, block) {
    el.style.left  = wedTimeToPx(block.start) + 'px';
    el.style.width = Math.max(6, wedTimeToPx(block.end - block.start)) + 'px';
}

function _wedUpdateBlockSel() {
    document.querySelectorAll('.wed-block').forEach(el => {
        el.classList.toggle('wed-selected', wed.selected.has(el.dataset.id));
    });
}

function _wedUniqueTracks() {
    const t = new Set(wed.blocks.map(b => b.trackIdx));
    return [...t].sort((a,b) => a-b);
}

function _wedSnap(t, ignoreId) {
    if (!wed.snap) return null;
    let best = null, bestD = WED_SNAP;
    wed.blocks.forEach(b => {
        if (b.id === ignoreId) return;
        [b.start, b.end].forEach(edge => {
            const d = Math.abs(edge - t);
            if (d < bestD) { bestD = d; best = edge; }
        });
    });
    [0, wed.duration].forEach(edge => {
        const d = Math.abs(edge - t);
        if (d < bestD) { bestD = d; best = edge; }
    });
    return best;
}

// ── INLINE EDIT ──
function _wedStartEdit(el, block, tx) {
    el.classList.add('wed-editing');
    tx.style.display = 'none';
    const inp = document.createElement('input');
    inp.type  = 'text';
    inp.className = 'wed-block-input';
    inp.value = block.words.join(' ');
    el.insertBefore(inp, el.querySelector('.wed-handle-r'));
    inp.focus(); inp.select();

    const finish = () => {
        const words = inp.value.trim().split(/\s+/).filter(Boolean);
        if (words.length) block.words = words;
        tx.textContent = block.words.join(' ');
        tx.style.display = '';
        inp.remove();
        el.classList.remove('wed-editing');
        _wedUpdateInspector();
        _wedSaveUndo();
        _wedSyncToAppState();
    };
    inp.addEventListener('blur', finish);
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') inp.blur();
        if (e.key === 'Escape') { tx.style.display=''; inp.remove(); el.classList.remove('wed-editing'); }
        e.stopPropagation();
    });
}

// ── PLAYHEAD ──
function _wedUpdatePlayhead() {
    const ph = document.getElementById('wedPlayhead');
    if (!ph) return;
    const x = wedTimeToPx(wed.currentTime);
    ph.style.left = x + 'px';
    const h = WED_RULER_H + WED_WAVEFORM_H + (_wedUniqueTracks().length || 1) * WED_TRACK_H;
    ph.style.height = h + 'px';

    _wedUpdatePhonePreview();
    _wedScrollToPlayhead(x);
}

function _wedScrollToPlayhead(x) {
    const sc = document.getElementById('wedScroll');
    if (!sc) return;
    const vl = sc.scrollLeft, vr = sc.scrollLeft + sc.clientWidth;
    if (wed.isPlaying && (x < vl + 30 || x > vr - 30)) {
        sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.3);
    }
}

// ── PHONE PREVIEW ──
function _wedUpdatePhonePreview() {
    const t   = wed.currentTime;
    const el  = document.getElementById('wedPhoneSubs');
    const td  = document.getElementById('wedTimeDisplay');
    const tt  = document.getElementById('wedTransportTime');

    if (td) td.textContent = `${t.toFixed(2)}s / ${wed.duration.toFixed(2)}s`;
    if (tt) tt.textContent = _wedFmtTimeFull(t);

    if (!el) return;
    const line = wed.blocks.find(b => t >= b.start - WED_LEAD && t < b.end - WED_LEAD);
    if (!line) { el.innerHTML = ''; return; }

    const clean  = line.words.map(w => w.replace(/[{}\\]/g,''));
    const half   = Math.ceil(clean.length / 2);
    const lineDur = (line.end - WED_LEAD) - (line.start - WED_LEAD);
    const prog   = (t - (line.start - WED_LEAD)) / lineDur;
    const aw     = Math.min(Math.floor(prog * clean.length), clean.length - 1);

    const rh = (words, off) =>
        `<div class="wed-sub-line">${words.map((w,i) =>
            `<span class="wed-sub-word${(off+i)===aw?' active':''}">${w}</span>`).join('')}</div>`;

    el.innerHTML = rh(clean.slice(0, half), 0) + (clean.length > half ? rh(clean.slice(half), half) : '');
}

// ── PLAYBACK ──
function wedTogglePlay() { wed.isPlaying ? wedPauseAudio() : wedPlayAudio(); }

function wedPlayAudio() {
    wed.isPlaying = true;
    const pi = document.getElementById('wedPlayIcon');
    if (pi) pi.className = 'fas fa-pause';
    if (wed.audioBuffer && wed.audioCtx) _wedStartAudioFrom(wed.currentTime);
    wed.startedAt     = performance.now() / 1000;
    wed.offsetAtStart = wed.currentTime;

    const tick = () => {
        if (!wed.isPlaying) return;
        wed.currentTime = wed.offsetAtStart + (performance.now()/1000 - wed.startedAt);
        if (wed.currentTime >= wed.duration) { wed.currentTime = wed.duration; wedPauseAudio(); return; }
        _wedUpdatePlayhead();
        wed.rafId = requestAnimationFrame(tick);
    };
    wed.rafId = requestAnimationFrame(tick);
}

function wedPauseAudio() {
    wed.isPlaying = false;
    const pi = document.getElementById('wedPlayIcon');
    if (pi) pi.className = 'fas fa-play';
    if (wed.audioSource) { try { wed.audioSource.stop(); } catch(_){} wed.audioSource = null; }
    if (wed.rafId) { cancelAnimationFrame(wed.rafId); wed.rafId = null; }
}

function _wedStartAudioFrom(offset) {
    if (!wed.audioBuffer || !wed.audioCtx) return;
    if (wed.audioSource) { try { wed.audioSource.stop(); } catch(_){} }
    const src = wed.audioCtx.createBufferSource();
    src.buffer = wed.audioBuffer;
    src.connect(wed.audioCtx.destination);
    src.start(0, Math.max(0, offset));
    wed.audioSource = src;
    wed.startedAt   = performance.now() / 1000;
    wed.offsetAtStart = offset;
}

function wedSeekTo(t) {
    wed.currentTime = Math.max(0, Math.min(wed.duration, t));
    if (wed.isPlaying && wed.audioBuffer) {
        if (wed.audioSource) { try { wed.audioSource.stop(); } catch(_){} }
        _wedStartAudioFrom(wed.currentTime);
    }
    _wedUpdatePlayhead();
}
function wedSeekRel(dt) { wedSeekTo(wed.currentTime + dt); }

// ── RULER / WAVEFORM CLICK ──
document.addEventListener('click', e => {
    const ruler = document.getElementById('wedRuler');
    const wave  = document.getElementById('wedWave');
    const sc    = document.getElementById('wedScroll');
    if (!sc) return;
    if (ruler && ruler.contains(e.target)) {
        const rect = ruler.getBoundingClientRect();
        wedSeekTo(wedPxToTime(e.clientX - rect.left + sc.scrollLeft));
    } else if (wave && wave.contains(e.target)) {
        const rect = wave.getBoundingClientRect();
        wedSeekTo(wedPxToTime(e.clientX - rect.left + sc.scrollLeft));
    }
});

// ── ZOOM ──
function wedSetZoom(val) {
    const sc       = document.getElementById('wedScroll');
    const centerT  = sc ? wedPxToTime(sc.scrollLeft + sc.clientWidth/2) : wed.currentTime;
    wed.zoom = parseFloat(val);
    _wedRender();
    if (sc) sc.scrollLeft = Math.max(0, wedTimeToPx(centerT) - sc.clientWidth/2);
}

// ── BLOCK OPS ──
function wedAddBlock() {
    _wedSaveUndo();
    const start = wed.currentTime;
    const end   = Math.min(wed.duration, start + 2);
    const b = { id: wedSid(), start, end, words:['New','subtitle'], trackIdx:0 };
    wed.blocks.push(b);
    wed.selected.clear();
    wed.selected.add(b.id);
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Block added', 'success');
}

function wedDeleteSelected() {
    if (wed.selected.size === 0) return;
    _wedSaveUndo();
    wed.blocks = wed.blocks.filter(b => !wed.selected.has(b.id));
    wed.selected.clear();
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Deleted', 'info');
}

function wedSplitSelected() {
    const block = _wedFirstSel();
    if (!block) { Toast.show('Select a block first', 'warning'); return; }
    if (wed.currentTime <= block.start || wed.currentTime >= block.end) {
        Toast.show('Playhead must be inside the selected block', 'warning'); return;
    }
    _wedSaveUndo();
    const at  = wed.currentTime;
    const mid = Math.ceil(block.words.length / 2);
    const wa  = block.words.slice(0, mid);
    const wb  = block.words.slice(mid).length ? block.words.slice(mid) : ['…'];
    const newA = { ...block, end: +at.toFixed(3), words: wa };
    const newB = { id: wedSid(), start: +at.toFixed(3), end: block.end, words: wb, trackIdx: block.trackIdx };
    const idx  = wed.blocks.indexOf(block);
    wed.blocks.splice(idx, 1, newA, newB);
    wed.selected.clear(); wed.selected.add(newA.id);
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Split at playhead', 'success');
}

function wedMergeSelected() {
    let sel = [...wed.selected];
    if (sel.length < 2) {
        const b = _wedFirstSel();
        if (!b) { Toast.show('Select blocks to merge', 'warning'); return; }
        const idx = wed.blocks.indexOf(b);
        if (idx >= wed.blocks.length - 1) { Toast.show('No next block to merge with', 'warning'); return; }
        sel.push(wed.blocks[idx+1].id);
    }
    _wedSaveUndo();
    const selBlocks = wed.blocks.filter(b => sel.includes(b.id));
    selBlocks.sort((a,b) => a.start - b.start);
    const merged = {
        id: selBlocks[0].id,
        start: selBlocks[0].start,
        end:   selBlocks[selBlocks.length-1].end,
        words: selBlocks.flatMap(b => b.words),
        trackIdx: selBlocks[0].trackIdx,
    };
    const fi = wed.blocks.indexOf(selBlocks[0]);
    wed.blocks = wed.blocks.filter(b => !sel.includes(b.id));
    wed.blocks.splice(fi, 0, merged);
    wed.selected.clear(); wed.selected.add(merged.id);
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Merged', 'success');
}

function wedDuplicate() {
    const b = _wedFirstSel();
    if (!b) return;
    _wedSaveUndo();
    const nb = { ...b, id: wedSid(), start: b.end+0.05, end: b.end+0.05+(b.end-b.start) };
    const idx = wed.blocks.indexOf(b);
    wed.blocks.splice(idx+1, 0, nb);
    wed.selected.clear(); wed.selected.add(nb.id);
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Duplicated', 'success');
}

function _wedFirstSel() {
    const id = [...wed.selected][0];
    return id ? wed.blocks.find(b => b.id === id) : null;
}

// ── APPLY ──
function wedApply() {
    _wedSyncToAppState();
    // Flash phone
    const ph = document.querySelector('.wed-phone');
    if (ph) {
        ph.style.boxShadow = '0 0 30px rgba(16,185,129,0.6)';
        setTimeout(() => ph.style.boxShadow = '', 700);
    }
    Toast.show(`${wed.blocks.length} subtitle lines applied!`, 'success');
}

function _wedSyncToAppState() {
    // Convert waveform editor blocks back to app editedLines format
    state.editedLines = wed.blocks
        .sort((a,b) => a.start - b.start)
        .map(b => ({ words: [...b.words], start: b.start, end: b.end }));
    state.subtitlesASS = buildSubtitlesFromLines(state.editedLines);
}

// ── UNDO / REDO ──
function _wedSaveUndo() {
    wed.undoStack.push(JSON.stringify(wed.blocks));
    wed.redoStack = [];
    if (wed.undoStack.length > 60) wed.undoStack.shift();
}
function wedUndo() {
    if (!wed.undoStack.length) { Toast.show('Nothing to undo', 'warning'); return; }
    wed.redoStack.push(JSON.stringify(wed.blocks));
    wed.blocks = JSON.parse(wed.undoStack.pop());
    wed.selected.clear();
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Undo', 'info');
}
function wedRedo() {
    if (!wed.redoStack.length) { Toast.show('Nothing to redo', 'warning'); return; }
    wed.undoStack.push(JSON.stringify(wed.blocks));
    wed.blocks = JSON.parse(wed.redoStack.pop());
    wed.selected.clear();
    _wedRenderBlocks();
    _wedUpdateInspector();
    _wedSyncToAppState();
    Toast.show('Redo', 'info');
}

// ── INSPECTOR ──
function _wedUpdateInspector() {
    const el  = document.getElementById('wedInspector');
    if (!el) return;
    const sel = [...wed.selected];

    if (sel.length === 0) {
        el.innerHTML = `<div class="wed-insp-empty"><i class="fas fa-mouse-pointer"></i> Click a block to inspect</div>`;
        return;
    }
    if (sel.length > 1) {
        el.innerHTML = `<div class="wed-insp-empty"><i class="fas fa-layer-group"></i> ${sel.length} blocks selected</div>
        <button class="wed-btn btn-sm" onclick="wedMergeSelected()"><i class="fas fa-compress"></i> Merge</button>
        <button class="wed-btn wed-danger btn-sm" style="margin-left:0.4rem" onclick="wedDeleteSelected()"><i class="fas fa-trash"></i> Delete All</button>`;
        return;
    }
    const block = wed.blocks.find(b => b.id === sel[0]);
    if (!block) return;
    const dur = (block.end - block.start).toFixed(3);
    el.innerHTML = `
        <div class="wed-insp-field-wide">
            <div class="wed-insp-label">Text</div>
            <textarea class="wed-insp-text" rows="1" oninput="wedInspTextChange(this.value)">${block.words.join(' ')}</textarea>
        </div>
        <div class="wed-insp-field">
            <div class="wed-insp-label">Start (s)</div>
            <input class="wed-insp-input" type="number" step="0.001" value="${block.start.toFixed(3)}" oninput="wedInspStartChange(this.value)">
        </div>
        <div class="wed-insp-field">
            <div class="wed-insp-label">End (s)</div>
            <input class="wed-insp-input" type="number" step="0.001" value="${block.end.toFixed(3)}" oninput="wedInspEndChange(this.value)">
        </div>
        <div class="wed-insp-field" style="min-width:60px">
            <div class="wed-insp-label">Duration</div>
            <div class="wed-insp-input" style="opacity:0.5;pointer-events:none;">${dur}s</div>
        </div>
        <div class="wed-insp-field" style="min-width:80px; align-self:flex-end;">
            <button class="wed-btn wed-danger" onclick="wedDeleteSelected()" style="width:100%"><i class="fas fa-trash"></i> Del</button>
        </div>
    `;
}

function wedInspTextChange(v) {
    const b = _wedFirstSel(); if(!b) return;
    b.words = v.trim().split(/\s+/).filter(Boolean);
    const tx = document.querySelector(`.wed-block[data-id="${b.id}"] .wed-block-text`);
    if (tx) tx.textContent = b.words.join(' ');
    _wedSyncToAppState();
}
function wedInspStartChange(v) {
    const b = _wedFirstSel(); if(!b) return;
    const n = parseFloat(v); if(isNaN(n)) return;
    b.start = Math.max(0, Math.min(b.end - WED_MIN_DUR, n));
    const el = document.querySelector(`.wed-block[data-id="${b.id}"]`);
    if (el) _wedPosBlock(el, b);
    _wedSyncToAppState();
}
function wedInspEndChange(v) {
    const b = _wedFirstSel(); if(!b) return;
    const n = parseFloat(v); if(isNaN(n)) return;
    b.end = Math.max(b.start + WED_MIN_DUR, n);
    const el = document.querySelector(`.wed-block[data-id="${b.id}"]`);
    if (el) _wedPosBlock(el, b);
    _wedSyncToAppState();
}

// ── CONTEXT MENU ──
function _wedShowCtx(x, y) {
    const m = document.getElementById('wedCtx');
    if (!m) return;
    m.style.left = x + 'px';
    m.style.top  = y + 'px';
    m.classList.add('visible');
}
function _wedHideCtx() {
    const m = document.getElementById('wedCtx');
    if (m) m.classList.remove('visible');
}
function wedCtxEdit() {
    _wedHideCtx();
    const b = _wedFirstSel(); if (!b) return;
    const el = document.querySelector(`.wed-block[data-id="${b.id}"]`);
    const tx = el?.querySelector('.wed-block-text');
    if (el && tx) _wedStartEdit(el, b, tx);
}
function wedCtxSplit() { _wedHideCtx(); wedSplitSelected(); }
function wedCtxMerge() { _wedHideCtx(); wedMergeSelected(); }

// ── KEYS ──
function _wedBindKeys() {
    document.addEventListener('keydown', e => {
        if (state.currentStep !== 2.5) return;
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.code === 'Space')       { e.preventDefault(); wedTogglePlay(); }
        if (e.code === 'ArrowLeft')   { e.preventDefault(); wedSeekRel(e.shiftKey ? -5 : -0.5); }
        if (e.code === 'ArrowRight')  { e.preventDefault(); wedSeekRel(e.shiftKey ? 5 :  0.5); }
        if (e.code === 'Delete' || e.code === 'Backspace') { if(wed.selected.size>0){ e.preventDefault(); wedDeleteSelected(); } }
        if ((e.ctrlKey||e.metaKey) && e.code==='KeyZ' && !e.shiftKey) { e.preventDefault(); wedUndo(); }
        if ((e.ctrlKey||e.metaKey) && (e.code==='KeyY' || (e.code==='KeyZ'&&e.shiftKey))) { e.preventDefault(); wedRedo(); }
        if (e.code === 'Escape') { wed.selected.clear(); _wedUpdateBlockSel(); _wedUpdateInspector(); }
    });
}

function _wedBindCtx() {
    document.addEventListener('mousedown', e => {
        const ctx = document.getElementById('wedCtx');
        if (ctx && !ctx.contains(e.target)) _wedHideCtx();
    });
    document.getElementById('wedSnapToggle')?.addEventListener('change', e => { wed.snap = e.target.checked; });
}

// ── UTILS ──
function _wedFmtTime(t) {
    const m = Math.floor(t/60);
    const s = (t%60).toFixed(1);
    return `${m}:${String(s.split('.')[0]).padStart(2,'0')}.${s.split('.')[1]}`;
}
function _wedFmtTimeFull(t) {
    const m  = Math.floor(t/60);
    const s  = Math.floor(t%60);
    const ms = Math.floor((t%1)*100);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'00')}`;
}

// Re-render on resize
window.addEventListener('resize', () => {
    if (state.currentStep === 2.5) _wedRender();
});

console.log('🚀 ArchNemix Studio v5.0 — Waveform Subtitle Editor');
