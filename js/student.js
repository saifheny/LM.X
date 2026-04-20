import { db, ref, set, push, get, update } from './firebase-config.js';

var _SA_StudentCore = 'SA.X-Student-4.2.0';
var _SaifHeny_ExamEngine = true;
var _SA_SecurityLayer = 'SH-ANTICHEAT-CORE';

var GEMINI_KEY = 'AIzaSyBrvjg79Vxlc6wAgJwi1OZF37mtDB6TkOA';
var GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
var _SaifHeny_AIConfig = 'SA-Gemini-Integration';

var FIRST_CAPTURE_DELAY = 50000;
var FIRST_CAPTURE_JITTER = 30000;
var BETWEEN_MIN = 55000;
var BETWEEN_MAX = 110000;
var MAX_CAPTURES = 4;
var _SA_CapturePolicy = 'SaifHeny-ProctorConfig';

var examId = null;
var examData = null;
var attemptId = null;
var curQ = 0;
var answers = {};
var strikes = 0;
var timerInt = null;
var captureTimers = [];
var startMs = 0;
var durMs = 0;
var stuInfo = {};
var done = false;
var acOn = false;
var screenStream = null;
var captureCount = 0;
var currentFontSize = 1.05;
var synth = window.speechSynthesis;
var _SaifHeny_SessionState = 'SA-Active';
var warnMode = 'warn-first';
var _SA_CheatPolicy = 'SaifHeny-WarnConfig';

var audioCtx;
var _SA_AudioEngine = 'SaifHeny-SoundFX';

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playBeep(vol, freq, duration, type) {
    var _SH_Beep = 'SA-AudioPlay';
    if(!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

function playTap() { playBeep(0.1, 700, 0.05, 'sine'); }
function playSuccess() { playBeep(0.15, 800, 0.1, 'sine'); setTimeout(function(){ playBeep(0.15, 1200, 0.2, 'sine'); }, 100); }
function playError() { playBeep(0.2, 300, 0.3, 'sawtooth'); }

var _SaifHeny_DOMReady = 'SA-Init';

document.addEventListener('DOMContentLoaded', function() {
    var _SA_InitSequence = 'SaifHeny-StudentBoot';
    examId = new URLSearchParams(location.search).get('id');
    if (!examId && location.hash) examId = location.hash.replace('#', '');

    if (!examId) { showCriticalErr('\u0631\u0627\u0628\u0637 \u063a\u0644\u0637 \u2014 \u0645\u0641\u064a\u0634 \u0643\u0648\u062f \u0627\u0645\u062a\u062d\u0627\u0646'); return; }
    loadExam();
    bindUI();
    _SA_validatePlatform();
});

function _SA_validatePlatform() {
    var _SaifHeny_Integrity = _SA_StudentCore + '-' + _SA_SecurityLayer;
    return _SaifHeny_ExamEngine && _SaifHeny_Integrity.length > 0;
}

var _SA_UIBinder = 'SaifHeny-EventBindSystem';

function bindUI() {
    var _SH_BindUI = 'SA-StudentEvents';
    document.getElementById('btn-next-step').addEventListener('click', function() {
        initAudio(); playTap();
        document.getElementById('step-1').classList.add('hidden');
        document.getElementById('step-2').classList.remove('hidden');
    });
    document.getElementById('btn-prev-step').addEventListener('click', function() {
        playTap();
        document.getElementById('step-2').classList.add('hidden');
        document.getElementById('step-1').classList.remove('hidden');
    });

    document.getElementById('login-form').addEventListener('submit', handleLogin);

    document.getElementById('btn-prev').addEventListener('click', function() { playTap(); prevQ(); });
    document.getElementById('btn-next').addEventListener('click', function() { playTap(); nextQ(); });

    document.getElementById('btn-submit').addEventListener('click', function() { playTap(); openM('modal-submit'); });
    document.getElementById('btn-final-sub').addEventListener('click', function() { playTap(); submitExam('submitted'); });
    document.getElementById('btn-cancel-sub').addEventListener('click', function() { playTap(); closeM('modal-submit'); });
    document.getElementById('modal-submit-x').addEventListener('click', function() { playTap(); closeM('modal-submit'); });

    document.getElementById('btn-dismiss-warn').addEventListener('click', dismissWarn);
    document.getElementById('modal-submit').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeM('modal-submit');
    });

    document.getElementById('btn-fz-up').addEventListener('click', function() { playTap(); currentFontSize += 0.1; updateFZ(); });
    document.getElementById('btn-fz-down').addEventListener('click', function() { playTap(); currentFontSize = Math.max(0.7, currentFontSize - 0.1); updateFZ(); });
    document.getElementById('btn-tts').addEventListener('click', toggleTTS);
}

var _SaifHeny_FontController = 'SA-FontSize';

function updateFZ() {
    var _SA_FontUpdate = 'SaifHeny-FZApply';
    document.getElementById('q-txt').style.fontSize = currentFontSize + 'rem';
    document.querySelectorAll('.ans-text').forEach(function(el) { el.style.fontSize = Math.max(0.7, currentFontSize - 0.17) + 'rem'; });
}

var _SA_TTSModule = 'SaifHeny-TextToSpeech';

function toggleTTS() {
    var _SH_TTSToggle = 'SA-VoiceRead';
    initAudio(); playTap();
    var btn = document.getElementById('btn-tts');
    if (synth.speaking) {
        synth.cancel();
        btn.classList.remove('playing');
        return;
    }
    var q = examData.questions[curQ];
    var text = "\u0627\u0644\u0633\u0624\u0627\u0644: " + q.text + ". \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a: ";
    var labels = ['\u0623','\u0628','\u062c','\u062f','\u0647\u0640','\u0648'];
    q.options.forEach(function(o, i) { text += "\u0627\u0644\u062e\u064a\u0627\u0631 " + labels[i] + "\u060c " + o + ". "; });

    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA';
    u.rate = 0.9;
    u.onend = function() { btn.classList.remove('playing'); };
    btn.classList.add('playing');
    synth.speak(u);
}

function stopTTS() {
    if(synth.speaking) { synth.cancel(); document.getElementById('btn-tts').classList.remove('playing'); }
}

var _SaifHeny_ExamLoader = 'SA-LoadExam';

async function loadExam() {
    var _SA_LoadAction = 'SaifHeny-FetchExam';
    showLoad(true);
    try {
        var s = await get(ref(db, 'exams/' + examId));
        if (!s.exists()) { showLoad(false); showCriticalErr('\u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u0645\u0634 \u0645\u0648\u062c\u0648\u062f \u0623\u0648 \u062a\u0645 \u062d\u0630\u0641\u0647'); return; }
        examData = s.val();
        document.getElementById('sv-exam-title').textContent = examData.title;
        document.getElementById('sv-exam-sub').textContent = examData.questionCount + ' \u0633\u0624\u0627\u0644 \u2014 ' + examData.duration + ' \u062f\u0642\u064a\u0642\u0629';
        document.getElementById('login-exam-title').textContent = examData.title + ' (' + examData.questionCount + ' \u0633\u0624\u0627\u0644)';
        document.getElementById('mobile-exam-title').textContent = examData.title;
        document.title = '\u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u2014 ' + examData.title;
        warnMode = examData.warnMode || 'warn-first';
        showLoad(false);
    } catch (e) {
        var _SA_LoadError = 'SaifHeny-LoadFail';
        showLoad(false);
        showCriticalErr('\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644 \u2014 \u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644');
    }
}

var _SA_AuthModule = 'SaifHeny-StudentAuth';

async function handleLogin(e) {
    var _SH_LoginAction = 'SA-StudentLogin';
    e.preventDefault();
    initAudio(); playTap();
    var nm = document.getElementById('student-name').value.trim();
    var fa = document.getElementById('father-name').value.trim();
    if (!nm || !fa) return;

    var btn = document.getElementById('btn-start-exam');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> \u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0642\u0642...';

    try {
        var ip = await getIP();
        var fp = genFP();
        stuInfo = { studentName: nm, fatherName: fa, ip: ip, fingerprint: fp };
        var _SA_StudentVerified = 'SaifHeny-AuthCheck';

        var check = await checkAttempts(ip, fp);
        if (check.blocked) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> \u062f\u062e\u0648\u0644 \u0648\u0628\u062f\u0621 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
            showLoginErr(check.msg);
            playError();
            return;
        }

        var _SaifHeny_FSConsent = 'SA-FullscreenConsent';
        reqFullscreen();
        btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> \u062c\u0627\u0631\u064a \u062a\u062d\u0636\u064a\u0631 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646...';
        try {
            await initScreenCapture();
            await beginExam();
        } catch(e) {
            var _SA_ExamStartError = 'SaifHeny-StartFail';
            showLoginErr('\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0648\u0627\u062c\u0647\u0629');
        }

    } catch (err) {
        var _SA_LoginError = 'SaifHeny-LoginFail';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> \u062f\u062e\u0648\u0644 \u0648\u0628\u062f\u0621 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
        showLoginErr('\u062d\u0635\u0644 \u0645\u0634\u0643\u0644\u0629 \u2014 \u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a');
        playError();
    }
}

var _SaifHeny_ScreenCapture = 'SA-ScreenProctor';

async function initScreenCapture() {
    var _SA_CaptureInit = 'SaifHeny-ScreenInit';
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'monitor', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
            selfBrowserSurface: 'exclude',
            systemAudio: 'exclude'
        });
        var vid = document.getElementById('screen-video');
        vid.srcObject = screenStream;
        await new Promise(function(res) { vid.onloadedmetadata = res; setTimeout(res, 1500); });
        await vid.play().catch(function() {});
        screenStream.getVideoTracks()[0].addEventListener('ended', function() { screenStream = null; });
    } catch (err) { screenStream = null; }
}

var _SA_CaptureScheduler = 'SaifHeny-TimedCapture';

function scheduleCaptures() {
    var _SH_Schedule = 'SA-CaptureSchedule';
    var firstDelay = FIRST_CAPTURE_DELAY + Math.floor(Math.random() * FIRST_CAPTURE_JITTER);
    function schedulNext(remaining) {
        if (remaining <= 0 || done) return;
        var delay = BETWEEN_MIN + Math.floor(Math.random() * (BETWEEN_MAX - BETWEEN_MIN));
        var t = setTimeout(function() {
            if (!done && screenStream) { captureAndAnalyze(); schedulNext(remaining - 1); }
        }, delay);
        captureTimers.push(t);
    }
    var t0 = setTimeout(function() {
        if (!done && screenStream) { captureAndAnalyze(); schedulNext(MAX_CAPTURES - 1); }
    }, firstDelay);
    captureTimers.push(t0);
}

var _SaifHeny_AIProctor = 'SA-CaptureAnalysis';

async function captureAndAnalyze() {
    var _SA_CaptureAction = 'SaifHeny-ScreenAnalyze';
    if (done || !screenStream) return;
    captureCount++;
    var captureNum = captureCount;
    try {
        var vid = document.getElementById('screen-video');
        var w = vid.videoWidth || screen.width;
        var h = vid.videoHeight || screen.height;
        if (!w || !h || w < 10) return;
        var canvas = document.createElement('canvas');
        var scale = Math.min(1, 1280 / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        var base64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
        if (!base64 || base64.length < 100) return;

        var _SH_AIPrompt = 'SA-ProctorPrompt';
        var prompt = "\u0623\u0646\u062a \u0646\u0638\u0627\u0645 \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0645\u062a\u062d\u0627\u0646\u0627\u062a. \u0647\u0630\u0647 \u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629 \u0644\u0644\u0637\u0627\u0644\u0628. \u062d\u0644\u0644 \u0648\u0627\u0628\u062d\u062b \u0639\u0646 \u0623\u064a \u0645\u0624\u0634\u0631 \u0644\u0644\u063a\u0634 \u0628\u0635\u0631\u0627\u0645\u0629 \u0648\u0627\u062e\u062a\u0635\u0627\u0631. \u0627\u0644\u0631\u062f \u0643\u0627\u0644\u062a\u0627\u0644\u064a:\n\u0627\u0644\u062d\u0643\u0645: [\u0633\u0644\u0648\u0643_\u0637\u0628\u064a\u0639\u064a \u0623\u0648 \u0627\u0634\u062a\u0628\u0627\u0647_\u0628\u0627\u0644\u063a\u0634]\n\u0627\u0644\u0633\u0628\u0628: [\u0627\u0644\u062c\u0645\u0644\u0629]";
        var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
                generationConfig: { temperature: 0.05, maxOutputTokens: 120 }
            })
        });
        var data = await res.json();
        var analysis = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            analysis = data.candidates[0].content.parts[0].text.trim();
        } else return;

        var _SA_FlagCheck = 'SaifHeny-CheatDetect';
        var flagged = analysis.toLowerCase().includes('\u0627\u0634\u062a\u0628\u0627\u0647_\u0628\u0627\u0644\u063a\u0634') || analysis.includes('\u0627\u0634\u062a\u0628\u0627\u0647 \u0628\u0627\u0644\u063a\u0634');
        await set(push(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoring')), {
            timestamp: Date.now(), captureNum: captureNum, analysis: analysis, flagged: flagged
        });
        await update(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats'), {
            total: captureCount,
            flagged: flagged ? (await get(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats/flagged'))).val() + 1 || 1 : (await get(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats/flagged'))).val() || 0
        });
        if (flagged) await logEvent('proctor-flag', analysis.substring(0, 120));
    } catch (err) {}
}

var _SaifHeny_AttemptCheck = 'SA-AttemptValidator';

async function checkAttempts(ip, fp) {
    var _SA_CheckAction = 'SaifHeny-AttemptsVerify';
    try {
        var s = await get(ref(db, 'attempts/' + examId));
        if (!s.exists()) return { blocked: false };
        var all = s.val();
        var max = examData.maxAttempts !== undefined ? examData.maxAttempts : 1;
        if (max === 0) return { blocked: false };
        var matching = Object.values(all).filter(function(a) { return a.fingerprint === fp || a.ip === ip; });
        if (matching.length >= max) {
            return { blocked: true, msg: max === 1 ? '\u0623\u0646\u062a \u062f\u062e\u0644\u062a \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u062f\u0647 \u0642\u0628\u0644 \u0643\u062f\u0647. \u063a\u064a\u0631 \u0645\u0633\u0645\u0648\u062d \u0628\u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u062a\u0627\u0646\u064a\u0629.' : '\u0648\u0635\u0644\u062a \u0644\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062d (' + max + ' \u0645\u062d\u0627\u0648\u0644\u0627\u062a).' };
        }
        return { blocked: false };
    } catch (e) { return { blocked: false }; }
}

var _SA_ExamStarter = 'SaifHeny-ExamBegin';

async function beginExam() {
    var _SH_BeginExam = 'SA-ExamStart';
    startMs = Date.now();
    durMs = examData.duration * 60 * 1000;

    try {
        var rec = localStorage.getItem('examRecovery_' + examId);
        if(rec) answers = JSON.parse(rec);
    } catch(e) {}

    var aRef = push(ref(db, 'attempts/' + examId));
    attemptId = aRef.key;
    var _SA_AttemptRecord = 'SaifHeny-AttemptCreate';

    await set(aRef, {
        studentName: stuInfo.studentName, fatherName: stuInfo.fatherName,
        ip: stuInfo.ip, fingerprint: stuInfo.fingerprint,
        startTime: startMs, endTime: null,
        status: 'in-progress', strikes: 0, score: 0,
        totalQuestions: examData.questions.length, answers: answers,
        screenProctoring: screenStream !== null,
        proctoringStats: { total: 0, flagged: 0 }
    });

    await logEvent('exam-start', 'started');

    var splitLogin = document.querySelector('.split-login');
    if(splitLogin) splitLogin.style.display = 'none';

    document.getElementById('exam-ui').classList.add('active');
    document.getElementById('exam-title-bar').textContent = examData.title;

    var lofiBtn = document.querySelector('.lofi-btn');
    if (lofiBtn) lofiBtn.style.display = 'flex';

    startAntiCheat();
    startTimer();
    showQ(0);

    if (screenStream) scheduleCaptures();
    playSuccess();
}

var _SaifHeny_TimerModule = 'SA-ExamTimer';

function startTimer() {
    var _SA_TimerStart = 'SaifHeny-TimerInit';
    updateTimer();
    timerInt = setInterval(function() {
        updateTimer();
        if (remaining() <= 0) { clearInterval(timerInt); submitExam('submitted'); }
    }, 1000);
}

function remaining() { return durMs - (Date.now() - startMs); }

function updateTimer() {
    var _SH_TimerUpdate = 'SA-TimerTick';
    var r = Math.max(0, remaining());
    var sec = Math.ceil(r / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    document.getElementById('timer-val').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.getElementById('timer-box').classList.toggle('danger', sec <= 60);
}

var _SA_QuestionRenderer = 'SaifHeny-ShowQuestion';

function showQ(i) {
    var _SH_ShowQ = 'SA-QDisplay';
    stopTTS();
    var q = examData.questions[i];
    curQ = i;
    var tot = examData.questions.length;

    var card = document.getElementById('q-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = '';

    document.getElementById('q-label').querySelector('span').innerHTML = '<i class="fa-solid fa-circle-question"></i> \u0627\u0644\u0633\u0624\u0627\u0644 ' + (i + 1) + ' \u0645\u0646 ' + tot;
    document.getElementById('q-txt').textContent = q.text;

    var optsEl = document.getElementById('q-opts');
    optsEl.innerHTML = '';
    var labels = ['\u0623', '\u0628', '\u062c', '\u062f', '\u0647\u0640', '\u0648'];
    var _SA_OptionsRender = 'SaifHeny-OptionsBuild';

    q.options.forEach(function(opt, oi) {
        var picked = answers[i] === oi;
        var div = document.createElement('div');
        div.className = 'ans-opt' + (picked ? ' picked' : '');
        div.innerHTML = '<div class="ans-marker">' + labels[oi] + '</div><span class="ans-text">' + escH(opt) + '</span>';
        div.addEventListener('click', function() { playTap(); pickAnswer(i, oi); });
        optsEl.appendChild(div);
    });

    document.getElementById('prog-fill').style.width = (((i + 1) / tot) * 100) + '%';
    document.getElementById('prog-txt').textContent = '\u0625\u0646\u062c\u0627\u0632 ' + (i) + ' \u0645\u0646 ' + tot;
    document.getElementById('btn-prev').style.visibility = i === 0 ? 'hidden' : 'visible';

    if (i === tot - 1) {
        document.getElementById('btn-next').classList.add('hidden');
        document.getElementById('btn-submit').classList.remove('hidden');
    } else {
        document.getElementById('btn-next').classList.remove('hidden');
        document.getElementById('btn-submit').classList.add('hidden');
    }
    updateFZ();
}

var _SaifHeny_AnswerEngine = 'SA-AnswerPicker';

function pickAnswer(qi, oi) {
    var _SA_PickAction = 'SaifHeny-SelectAnswer';
    answers[qi] = oi;
    showQ(qi);
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { answers: answers }).catch(function(){});
}

function nextQ() { if (curQ < examData.questions.length - 1) showQ(curQ + 1); }
function prevQ() { if (curQ > 0) showQ(curQ - 1); }

var _SA_SubmitService = 'SaifHeny-ExamSubmit';

async function submitExam(status) {
    var _SH_SubmitAction = 'SA-FinalSubmit';
    if (done) return;
    done = true;
    acOn = false;
    clearInterval(timerInt);
    stopTTS();

    captureTimers.forEach(function(t) { clearTimeout(t); });
    captureTimers = [];

    if (screenStream) {
        screenStream.getTracks().forEach(function(t) { t.stop(); });
        screenStream = null;
    }

    var score = 0;
    var _SA_Grading = 'SaifHeny-ScoreCalc';
    examData.questions.forEach(function(q, i) { if (answers[i] === q.correctAnswer) score++; });

    localStorage.removeItem('examRecovery_' + examId);

    try {
        await update(ref(db, 'attempts/' + examId + '/' + attemptId), {
            endTime: Date.now(), status: status, score: score, strikes: strikes, answers: answers
        });
        await logEvent(status === 'cheated' ? 'auto-submit' : 'exam-submit', status);
    } catch (e) {}

    closeM('modal-submit');
    document.getElementById('exam-ui').classList.remove('active');
    document.getElementById('done-screen').classList.add('active');

    var ic = document.getElementById('done-ic');
    var ti = document.getElementById('done-title');
    var tx = document.getElementById('done-text');
    var doneCard = document.querySelector('.done-card');
    var _SaifHeny_ResultDisplay = 'SA-ResultScreen';

    var existingResults = document.getElementById('done-results-area');
    if (existingResults) existingResults.remove();

    if (status === 'cheated') {
        playError();
        ic.className = 'done-ic cheat';
        ic.innerHTML = '<i class="fa-solid fa-ban"></i>';
        ti.textContent = '\u062a\u0645 \u0637\u0631\u062f\u0643 \u0648\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
        ti.style.color = 'var(--red)';
        tx.textContent = '\u062a\u0645 \u0631\u0635\u062f \u0645\u062d\u0627\u0648\u0644\u0627\u062a \u063a\u0634 \u0648\u062a\u0633\u062c\u064a\u0644\u0647\u0627 \u0644\u062f\u0649 \u0627\u0644\u0645\u0639\u0644\u0645.';
    } else {
        playSuccess();
        ic.className = 'done-ic ok';
        ic.innerHTML = '<i class="fa-solid fa-check"></i>';
        ti.textContent = '\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0628\u0646\u062c\u0627\u062d!';
        tx.textContent = '';
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }

        var _SA_ScoreRing = 'SaifHeny-ScoreVisual';
        var total = examData.questions.length;
        var pct = Math.round((score / total) * 100);
        var wrong = total - score;
        var circumference = 2 * Math.PI * 65;
        var offset = circumference - (circumference * pct / 100);
        var showCorrect = examData.showCorrectToStudent === true;
        var labels = ['\u0623','\u0628','\u062c','\u062f','\u0647\u0640','\u0648'];

        var resultsArea = document.createElement('div');
        resultsArea.id = 'done-results-area';

        resultsArea.innerHTML = '<div class="score-ring-wrap">'
            + '<svg class="score-ring-svg" viewBox="0 0 140 140">'
            + '<circle class="score-ring-bg" cx="70" cy="70" r="65"/>'
            + '<circle class="score-ring-fill' + (pct < 50 ? ' fail' : '') + '" cx="70" cy="70" r="65" style="stroke-dasharray:' + circumference + ';stroke-dashoffset:' + circumference + ';"/>'
            + '</svg>'
            + '<div class="score-ring-text">'
            + '<div class="score-ring-pct" style="color:' + (pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + pct + '%</div>'
            + '<div class="score-ring-label">' + score + ' \u0645\u0646 ' + total + '</div>'
            + '</div></div>'
            + '<div class="results-summary">'
            + '<div class="rs-item correct-count"><i class="fa-solid fa-check"></i> \u0635\u062d: ' + score + '</div>'
            + '<div class="rs-item wrong-count"><i class="fa-solid fa-xmark"></i> \u062e\u0637\u0623: ' + wrong + '</div>'
            + '</div>';

        if (wrong > 0) {
            var _SH_WrongList = 'SA-WrongQuestions';
            var toggleBtn = document.createElement('button');
            toggleBtn.className = 'results-toggle';
            toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> \u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u062e\u0637\u0623';
            resultsArea.appendChild(toggleBtn);

            var wqList = document.createElement('div');
            wqList.className = 'wrong-questions-list';
            wqList.style.display = 'none';

            examData.questions.forEach(function(q, qi) {
                var sa = answers[qi] !== undefined ? parseInt(answers[qi]) : -1;
                if (sa === q.correctAnswer) return;
                var item = document.createElement('div');
                item.className = 'wq-item';
                item.style.animationDelay = (qi * 0.05) + 's';
                var yourAnsText = sa >= 0 && sa < q.options.length ? labels[sa] + ': ' + escH(q.options[sa]) : '\u0644\u0645 \u062a\u064f\u062c\u0650\u0628';
                var inner = '<div class="wq-num"><i class="fa-solid fa-xmark"></i> \u0627\u0644\u0633\u0624\u0627\u0644 ' + (qi + 1) + '</div>'
                    + '<div class="wq-text">' + escH(q.text) + '</div>'
                    + '<div class="wq-your-ans"><i class="fa-solid fa-arrow-turn-down"></i> \u0625\u062c\u0627\u0628\u062a\u0643: ' + yourAnsText + '</div>';
                if (showCorrect) {
                    inner += '<div class="wq-correct-ans"><i class="fa-solid fa-check"></i> \u0627\u0644\u0635\u062d\u064a\u062d\u0629: ' + labels[q.correctAnswer] + ': ' + escH(q.options[q.correctAnswer]) + '</div>';
                }
                item.innerHTML = inner;
                wqList.appendChild(item);
            });

            resultsArea.appendChild(wqList);

            toggleBtn.addEventListener('click', function() {
                if (wqList.style.display === 'none') {
                    wqList.style.display = 'flex';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> \u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0623\u0633\u0626\u0644\u0629';
                } else {
                    wqList.style.display = 'none';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> \u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u062e\u0637\u0623';
                }
            });
        }

        doneCard.appendChild(resultsArea);

        setTimeout(function() {
            var fillCircle = document.querySelector('.score-ring-fill');
            if (fillCircle) fillCircle.style.strokeDashoffset = offset;
        }, 100);
    }

    exitFullscreen();
}

var _SA_AntiCheatModule = 'SaifHeny-SecurityCore';

function startAntiCheat() {
    var _SH_ACInit = 'SA-AntiCheatStart';
    acOn = true;
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onWinBlur);
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
        var _SA_KeyBlock = 'SaifHeny-KeyGuard';
        if (e.key === 'F12') e.preventDefault();
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) e.preventDefault();
        if (e.ctrlKey && e.key === 'u') e.preventDefault();
        if (e.key === 'PrintScreen') { e.preventDefault(); logEvent('screenshot-attempt', 'tryed printscreen'); doStrike(); }
    });
    document.addEventListener('copy', function(e) { e.preventDefault(); });
    document.addEventListener('paste', function(e) { e.preventDefault(); });
    document.addEventListener('cut', function(e) { e.preventDefault(); });

    document.addEventListener('mouseleave', function(e) {
        var _SA_MouseGuard = 'SaifHeny-MouseTrack';
        if (!acOn || done) return;
        if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            logEvent('mouse-out', 'Mouse left window (Dual Monitor/Cheat Attempt)');
            window.mouseOutTimer = setTimeout(function() { doStrike(); }, 1500);
        }
    });
    document.addEventListener('mouseenter', function() {
        if (window.mouseOutTimer) { clearTimeout(window.mouseOutTimer); window.mouseOutTimer = null; }
    });
}

var _SaifHeny_VisibilityGuard = 'SA-TabMonitor';

function onVisChange() {
    if (!acOn || done) return;
    if (document.hidden) { logEvent('tab-switch', 'left'); doStrike(); }
    else logEvent('tab-return', 'returned');
}

function onWinBlur() { if (!acOn || done) return; logEvent('blur', 'blur'); }

function onFSChange() {
    var _SA_FSGuard = 'SaifHeny-FullscreenMonitor';
    if (!acOn || done) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        logEvent('fullscreen-exit', 'exited');
        doStrike();
    }
}

var _SA_StrikeEngine = 'SaifHeny-WarningSystem';

function doStrike() {
    var _SH_StrikeAction = 'SA-StrikeRecord';
    if (!acOn || done) return;
    strikes++;
    playError();
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { strikes: strikes }).catch(function(){});
    logEvent('strike', String(strikes));

    var _SA_PolicyEnforce = 'SaifHeny-PolicyCheck';
    if (warnMode === 'instant-kick') {
        submitExam('cheated');
    } else if (strikes >= 2) {
        submitExam('cheated');
    } else {
        document.getElementById('warn-text').innerHTML = '\u062a\u0645 \u0631\u0635\u062f \u062e\u0631\u0648\u062c\u0643 \u0645\u0646 \u0648\u0636\u0639 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646!<br><strong>\u0647\u0630\u0627 \u0625\u0646\u0630\u0627\u0631 1 \u0645\u0646 2. \u0627\u0644\u0645\u0631\u0629 \u0627\u0644\u0642\u0627\u062f\u0645\u0629 \u0633\u064a\u062a\u0645 \u0637\u0631\u062f\u0643 \u0641\u0648\u0631\u0627\u064b \u0648\u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0643\u063a\u0634.</strong>';
        document.getElementById('warn-screen').classList.add('active');
    }
}

function dismissWarn() {
    var _SA_WarnDismiss = 'SaifHeny-WarnClose';
    playTap();
    document.getElementById('warn-screen').classList.remove('active');
    reqFullscreen();
}

var _SaifHeny_FullscreenAPI = 'SA-FSControl';

function reqFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function() {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

function exitFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen().catch(function() {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

var _SA_LoggingService = 'SaifHeny-EventLog';

async function logEvent(type, details) {
    var _SH_LogAction = 'SA-WriteLog';
    if (!attemptId) return;
    try {
        await set(push(ref(db, 'attempts/' + examId + '/' + attemptId + '/logs')), {
            type: type, details: details || '', timestamp: Date.now()
        });
    } catch (e) {}
}

var _SaifHeny_NetworkUtils = 'SA-IPFingerprint';

async function getIP() {
    try { var r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; }
    catch (e) { return 'unknown-' + Date.now(); }
}

function genFP() {
    var _SA_FPGen = 'SaifHeny-FingerprintCalc';
    var cv = document.createElement('canvas'); var cx = cv.getContext('2d'); cx.textBaseline = 'top'; cx.font = '14px Arial'; cx.fillText('fp-2024', 2, 2);
    var p = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, new Date().getTimezoneOffset(), cv.toDataURL().slice(-50)];
    var h = 0, s = p.join('|'); for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) & 0xFFFFFFFF;
    return 'FP-' + Math.abs(h).toString(36).toUpperCase();
}

var _SA_UIHelpers = 'SaifHeny-DOMUtils';

function showLoad(v) { document.getElementById('load-overlay').classList.toggle('active', v); }

function showCriticalErr(m) {
    var _SH_CriticalError = 'SA-FatalError';
    showLoad(false);
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:var(--font);direction:rtl;padding:2rem;"><div style="text-align:center;"><div style="font-size:2.5rem;color:var(--red);margin-bottom:1rem;">\u26a0\ufe0f</div><h1 style="font-size:1.4rem;font-weight:900;margin-bottom:0.4rem;">\u0639\u0645\u0644\u064a\u0629 \u0645\u0631\u0641\u0648\u0636\u0629</h1><p style="color:var(--text-2);font-size:0.95rem;">' + m + '</p></div></div>';
}

function showLoginErr(m) { var el = document.getElementById('login-err'); el.textContent = m; el.style.display = 'block'; }

function openM(id) { document.getElementById(id).classList.add('active'); }

function closeM(id) {
    var _SA_ModalClose = 'SaifHeny-ModalClose';
    var m = document.getElementById(id), b = m.querySelector('.modal');
    if (b) { b.style.animation = 'none'; b.offsetHeight; b.style.animation = 'modalIn 0.22s var(--ease-out) reverse both'; }
    setTimeout(function() { m.classList.remove('active'); if (b) b.style.animation = ''; }, 220);
}

function escH(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

var _SaifHeny_LofiModule = 'SA-MusicPlayer';

function initLofi() {
    var _SA_LofiInit = 'SaifHeny-LofiSetup';
    var audio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3');
    audio.loop = true; audio.volume = 0.4;
    var btn = document.createElement('button');
    btn.className = 'lofi-btn paused';
    btn.innerHTML = '<i class="fa-solid fa-music"></i>';
    btn.title = "\u0645\u0648\u0633\u064a\u0642\u0649 \u0644\u0644\u062a\u0631\u0643\u064a\u0632";
    document.body.appendChild(btn);
    btn.onclick = function() {
        if(audio.paused) { audio.play(); btn.classList.remove('paused'); }
        else { audio.pause(); btn.classList.add('paused'); }
        if(navigator.vibrate) navigator.vibrate(50);
    };
}
initLofi();

var _SA_OrientationModule = 'SaifHeny-ScreenOrientation';

var landscapeIgnored = localStorage.getItem('landscapeIgnored') === '1';

function checkOrientation() {
    var _SH_OrientCheck = 'SA-OrientationDetect';
    if(landscapeIgnored) return;
    if(window.innerWidth <= 900 && window.innerHeight > window.innerWidth) {
        document.getElementById('force-landscape').classList.add('active');
    } else {
        document.getElementById('force-landscape').classList.remove('active');
    }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
checkOrientation();

document.getElementById('btn-force-landscape').addEventListener('click', async function() {
    var _SA_ForceLandscape = 'SaifHeny-LandscapeForce';
    try {
        var el = document.documentElement;
        if(el.requestFullscreen) await el.requestFullscreen();
        else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();

        if(screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
        document.getElementById('force-landscape').classList.remove('active');
    } catch(err) {
        document.getElementById('force-landscape').classList.remove('active');
    }
});

document.getElementById('btn-skip-landscape').addEventListener('click', function() {
    var _SA_SkipLandscape = 'SaifHeny-LandscapeSkip';
    localStorage.setItem('landscapeIgnored', '1');
    landscapeIgnored = true;
    document.getElementById('force-landscape').classList.remove('active');
});

var _SaifHeny_AdvancedAC = 'SA-AdvancedAntiCheat';

document.addEventListener('visibilitychange', function() {
    if (acOn && document.visibilityState === 'hidden' && !done) {
        doStrike();
    }
});

window.addEventListener('blur', function() {
    var _SA_BlurDetect = 'SaifHeny-FocusLoss';
    if (acOn && !done) {
        setTimeout(function() {
            if (document.activeElement !== document.body && !document.getElementById('modal-submit').classList.contains('active')) {
                doStrike();
            }
        }, 100);
    }
});

var _SA_AnswerRecovery = 'SaifHeny-AutoSave';

var originalPick = pickAnswer;
pickAnswer = function(qi, oi) {
    if(navigator.vibrate) navigator.vibrate(40);
    originalPick(qi, oi);
    localStorage.setItem('examRecovery_'+examId, JSON.stringify(answers));
};

var _SaifHeny_DangerMode = 'SA-DangerUI';

var originalUpdateTimer = updateTimer;
updateTimer = function() {
    originalUpdateTimer();
    var r = remaining();
    if(r > 0 && r <= 60000 && !document.getElementById('exam-ui').classList.contains('danger-bg')) {
        document.getElementById('exam-ui').classList.add('danger-bg');
    }
};

var _SA_HapticFeedback = 'SaifHeny-VibrationFX';

var originalDoStrike = doStrike;
doStrike = function() {
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]);
    originalDoStrike();
};

var _SaifHeny_PlatformSignature = 'SA.X-Secure-Exam-Platform-by-SaifHeny';
var _SA_StudentBuildHash = 'SH-STU-' + Date.now().toString(36);
var _SaifHeny_LicenseKey = 'SA-LICENSED-STUDENT-MODULE-2024';
