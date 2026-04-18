import { db, ref, set, push, get, update } from './firebase-config.js';

var GEMINI_KEY = 'AIzaSyBrvjg79Vxlc6wAgJwi1OZF37mtDB6TkOA';
var GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

var FIRST_CAPTURE_DELAY = 50000;
var FIRST_CAPTURE_JITTER = 30000;
var BETWEEN_MIN = 55000;
var BETWEEN_MAX = 110000;
var MAX_CAPTURES = 4;

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

// ──────────────── AUDIO UI ────────────────
var audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playBeep(vol, freq, duration, type) {
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


// ──────────────── INIT ────────────────
document.addEventListener('DOMContentLoaded', function() {
    examId = new URLSearchParams(location.search).get('id');
    if (!examId) { showCriticalErr('رابط غلط — مفيش كود امتحان'); return; }
    loadExam();
    bindUI();
});

function bindUI() {
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

function updateFZ() {
    document.getElementById('q-txt').style.fontSize = currentFontSize + 'rem';
    document.querySelectorAll('.ans-text').forEach(function(el) { el.style.fontSize = Math.max(0.7, currentFontSize - 0.17) + 'rem'; });
}

function toggleTTS() {
    initAudio(); playTap();
    var btn = document.getElementById('btn-tts');
    if (synth.speaking) {
        synth.cancel();
        btn.classList.remove('playing');
        return;
    }
    var q = examData.questions[curQ];
    var text = "السؤال: " + q.text + ". الخيارات: ";
    var labels = ['أ','ب','ج','د','هـ','و'];
    q.options.forEach(function(o, i) { text += "الخيار " + labels[i] + "، " + o + ". "; });
    
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


// ──────────────── EXAM LOADING & LOGIN ────────────────
async function loadExam() {
    showLoad(true);
    try {
        var s = await get(ref(db, 'exams/' + examId));
        if (!s.exists()) { showLoad(false); showCriticalErr('الامتحان مش موجود أو تم حذفه'); return; }
        examData = s.val();
        document.getElementById('sv-exam-title').textContent = examData.title;
        document.getElementById('sv-exam-sub').textContent = examData.questionCount + ' سؤال — ' + examData.duration + ' دقيقة';
        document.getElementById('login-exam-title').textContent = examData.title + ' (' + examData.questionCount + ' سؤال)';
        document.getElementById('mobile-exam-title').textContent = examData.title;
        document.title = 'الامتحان — ' + examData.title;
        showLoad(false);
    } catch (e) {
        console.error(e);
        showLoad(false);
        showCriticalErr('مشكلة في التحميل — تأكد من الاتصال');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    initAudio(); playTap();
    var nm = document.getElementById('student-name').value.trim();
    var fa = document.getElementById('father-name').value.trim();
    if (!nm || !fa) return;

    var btn = document.getElementById('btn-start-exam');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> جاري التحقق...';

    try {
        var ip = await getIP();
        var fp = genFP();
        stuInfo = { studentName: nm, fatherName: fa, ip: ip, fingerprint: fp };

        var check = await checkAttempts(ip, fp);
        if (check.blocked) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول وبدء الامتحان';
            showLoginErr(check.msg);
            playError();
            return;
        }

        btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> جاري تحضير الامتحان...';

        await initScreenCapture();
        await beginExam();

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول وبدء الامتحان';
        showLoginErr('حصل مشكلة — حاول تاني');
        playError();
    }
}


// ──────────────── PROCTORING ────────────────
async function initScreenCapture() {
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

        screenStream.getVideoTracks()[0].addEventListener('ended', function() {
            screenStream = null;
        });
    } catch (err) {
        screenStream = null; // User denied or error, continue without AI proctoring (but strike system works)
    }
}

function scheduleCaptures() {
    var firstDelay = FIRST_CAPTURE_DELAY + Math.floor(Math.random() * FIRST_CAPTURE_JITTER);

    function schedulNext(remaining) {
        if (remaining <= 0 || done) return;
        var delay = BETWEEN_MIN + Math.floor(Math.random() * (BETWEEN_MAX - BETWEEN_MIN));
        var t = setTimeout(function() {
            if (!done && screenStream) {
                captureAndAnalyze();
                schedulNext(remaining - 1);
            }
        }, delay);
        captureTimers.push(t);
    }

    var t0 = setTimeout(function() {
        if (!done && screenStream) {
            captureAndAnalyze();
            schedulNext(MAX_CAPTURES - 1);
        }
    }, firstDelay);
    captureTimers.push(t0);
}

async function captureAndAnalyze() {
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

        var prompt = 'أنت نظام مراقبة امتحانات. هذه لقطة شاشة لطالب يأدي امتحانًا إلكترونيًا الآن.\n\n'
            + 'حلل الصورة وابحث عن أي مؤشرات غش مثل:\n'
            + '- فتح تبويبات أو برامج أخرى غير صفحة الامتحان\n'
            + '- استخدام محركات بحث أو مواقع إجابات\n'
            + '- فتح ملفات أو وثائق خارجية\n'
            + '- أي نشاط مريب على الشاشة\n\n'
            + 'رد بهذا التنسيق فقط:\n'
            + 'الحكم: [سلوك_طبيعي أو اشتباه_بالغش]\n'
            + 'السبب: [جملة واحدة مختصرة]';

        var res = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
                    generationConfig: { temperature: 0.05, maxOutputTokens: 120 }
                })
            }
        );

        var data = await res.json();
        var analysis = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            analysis = data.candidates[0].content.parts[0].text.trim();
        } else return;

        var flagged = analysis.toLowerCase().includes('اشتباه_بالغش') || analysis.includes('اشتباه بالغش');

        await set(push(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoring')), {
            timestamp: Date.now(), captureNum: captureNum, analysis: analysis, flagged: flagged
        });

        await update(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats'), {
            total: captureCount,
            flagged: flagged
                ? (await get(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats/flagged'))).val() + 1 || 1
                : (await get(ref(db, 'attempts/' + examId + '/' + attemptId + '/proctoringStats/flagged'))).val() || 0
        });

        if (flagged) await logEvent('proctor-flag', analysis.substring(0, 120));
    } catch (err) { console.error('PROCTOR:', err); }
}


// ──────────────── EXAM CORE ────────────────
async function checkAttempts(ip, fp) {
    try {
        var s = await get(ref(db, 'attempts/' + examId));
        if (!s.exists()) return { blocked: false };
        var all = s.val();
        var max = examData.maxAttempts !== undefined ? examData.maxAttempts : 1;
        if (max === 0) return { blocked: false };
        var matching = Object.values(all).filter(function(a) { return a.fingerprint === fp || a.ip === ip; });
        if (matching.length >= max) {
            return { blocked: true, msg: max === 1 ? 'أنت دخلت الامتحان ده قبل كده. غير مسموح بالدخول مرة تانية.' : 'وصلت للحد الأقصى المسموح (' + max + ' محاولات).' };
        }
        return { blocked: false };
    } catch (e) { return { blocked: false }; }
}

async function beginExam() {
    startMs = Date.now();
    durMs = examData.duration * 60 * 1000;

    try {
        var rec = localStorage.getItem('examRecovery_' + examId);
        if(rec) answers = JSON.parse(rec);
    } catch(e) {}

    var aRef = push(ref(db, 'attempts/' + examId));
    attemptId = aRef.key;

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

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('exam-ui').classList.add('active');
    document.getElementById('exam-title-bar').textContent = examData.title;

    reqFullscreen();
    startAntiCheat();
    startTimer();
    showQ(0);

    if (screenStream) scheduleCaptures();
    playSuccess();
}

function startTimer() {
    updateTimer();
    timerInt = setInterval(function() {
        updateTimer();
        if (remaining() <= 0) { clearInterval(timerInt); submitExam('submitted'); }
    }, 1000);
}

function remaining() { return durMs - (Date.now() - startMs); }

function updateTimer() {
    var r = Math.max(0, remaining());
    var sec = Math.ceil(r / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    document.getElementById('timer-val').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.getElementById('timer-box').classList.toggle('danger', sec <= 60);
}

function showQ(i) {
    stopTTS();
    var q = examData.questions[i];
    curQ = i;
    var tot = examData.questions.length;

    var card = document.getElementById('q-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = '';

    document.getElementById('q-label').querySelector('span').innerHTML = '<i class="fa-solid fa-circle-question"></i> السؤال ' + (i + 1) + ' من ' + tot;
    document.getElementById('q-txt').textContent = q.text;

    var optsEl = document.getElementById('q-opts');
    optsEl.innerHTML = '';
    var labels = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

    q.options.forEach(function(opt, oi) {
        var picked = answers[i] === oi;
        var div = document.createElement('div');
        div.className = 'ans-opt' + (picked ? ' picked' : '');
        div.innerHTML = '<div class="ans-marker">' + labels[oi] + '</div><span class="ans-text">' + escH(opt) + '</span>';
        div.addEventListener('click', function() { playTap(); pickAnswer(i, oi); });
        optsEl.appendChild(div);
    });

    document.getElementById('prog-fill').style.width = (((i + 1) / tot) * 100) + '%';
    document.getElementById('prog-txt').textContent = 'إنجاز ' + (i) + ' من ' + tot;
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

function pickAnswer(qi, oi) {
    answers[qi] = oi;
    showQ(qi);
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { answers: answers }).catch(console.error);
}

function nextQ() { if (curQ < examData.questions.length - 1) showQ(curQ + 1); }
function prevQ() { if (curQ > 0) showQ(curQ - 1); }

async function submitExam(status) {
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
    examData.questions.forEach(function(q, i) { if (answers[i] === q.correctAnswer) score++; });

    localStorage.removeItem('examRecovery_' + examId);

    try {
        await update(ref(db, 'attempts/' + examId + '/' + attemptId), {
            endTime: Date.now(), status: status, score: score, strikes: strikes, answers: answers
        });
        await logEvent(status === 'cheated' ? 'auto-submit' : 'exam-submit', status);
    } catch (e) { console.error(e); }

    closeM('modal-submit');
    document.getElementById('exam-ui').classList.remove('active');
    document.getElementById('done-screen').classList.add('active');

    var ic = document.getElementById('done-ic');
    var ti = document.getElementById('done-title');
    var tx = document.getElementById('done-text');

    if (status === 'cheated') {
        playError();
        ic.className = 'done-ic cheat';
        ic.innerHTML = '<i class="fa-solid fa-ban"></i>';
        ti.textContent = 'تم طردك وإنهاء الامتحان';
        ti.style.color = 'var(--red)';
        tx.textContent = 'تم رصد محاولات غش وتسجيلها لدى المعلم.';
    } else {
        playSuccess();
        ic.className = 'done-ic ok';
        ic.innerHTML = '<i class="fa-solid fa-check"></i>';
        ti.textContent = 'نجاح وتم التسليم!';
        tx.textContent = 'تم استلام الإجابات بنجاح. أغلِق هذه الصفحة الآن.';
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
    }

    exitFullscreen();
}


// ──────────────── ANTI-CHEAT ────────────────
function startAntiCheat() {
    acOn = true;
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onWinBlur);
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12') e.preventDefault();
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) e.preventDefault();
        if (e.ctrlKey && e.key === 'u') e.preventDefault();
        if (e.key === 'PrintScreen') { e.preventDefault(); logEvent('screenshot-attempt', 'tryed printscreen'); doStrike(); }
    });
    document.addEventListener('copy', function(e) { e.preventDefault(); });
    document.addEventListener('paste', function(e) { e.preventDefault(); });
}

function onVisChange() {
    if (!acOn || done) return;
    if (document.hidden) { logEvent('tab-switch', 'left'); doStrike(); }
    else logEvent('tab-return', 'returned');
}
function onWinBlur() { if (!acOn || done) return; logEvent('blur', 'blur'); }
function onFSChange() {
    if (!acOn || done) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        logEvent('fullscreen-exit', 'exited');
        doStrike();
    }
}

function doStrike() {
    if (!acOn || done) return;
    strikes++;
    playError();
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { strikes: strikes }).catch(console.error);
    logEvent('strike', String(strikes));
    
    if (strikes >= 2) { 
        submitExam('cheated'); 
    } else { 
        document.getElementById('warn-text').innerHTML = 'تم رصد خروجك من وضع الامتحان!<br><strong>هذا إنذار 1 من 2. المرة القادمة سيتم طردك فوراً والتسليم كغش.</strong>';
        document.getElementById('warn-screen').classList.add('active'); 
    }
}

function dismissWarn() {
    playTap();
    document.getElementById('warn-screen').classList.remove('active');
    reqFullscreen();
}

function reqFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function() {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
function exitFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen().catch(function() {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

async function logEvent(type, details) {
    if (!attemptId) return;
    try {
        await set(push(ref(db, 'attempts/' + examId + '/' + attemptId + '/logs')), {
            type: type, details: details || '', timestamp: Date.now()
        });
    } catch (e) { console.error(e); }
}

async function getIP() {
    try { var r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; } 
    catch (e) { return 'unknown-' + Date.now(); }
}
function genFP() {
    var cv = document.createElement('canvas'); var cx = cv.getContext('2d'); cx.textBaseline = 'top'; cx.font = '14px Arial'; cx.fillText('fp-2024', 2, 2);
    var p = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, new Date().getTimezoneOffset(), cv.toDataURL().slice(-50)];
    var h = 0, s = p.join('|'); for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) & 0xFFFFFFFF;
    return 'FP-' + Math.abs(h).toString(36).toUpperCase();
}
function showLoad(v) { document.getElementById('load-overlay').classList.toggle('active', v); }
function showCriticalErr(m) {
    showLoad(false);
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:var(--font);direction:rtl;padding:2rem;"><div style="text-align:center;"><div style="font-size:2.5rem;color:var(--red);margin-bottom:1rem;">⚠️</div><h1 style="font-size:1.4rem;font-weight:900;margin-bottom:0.4rem;">عملية مرفوضة</h1><p style="color:var(--text-2);font-size:0.95rem;">' + m + '</p></div></div>';
}
function showLoginErr(m) { var el = document.getElementById('login-err'); el.textContent = m; el.style.display = 'block'; }
function openM(id) { document.getElementById(id).classList.add('active'); }
function closeM(id) {
    var m = document.getElementById(id), b = m.querySelector('.modal');
    if (b) { b.style.animation = 'none'; b.offsetHeight; b.style.animation = 'modalIn 0.22s var(--ease-out) reverse both'; }
    setTimeout(function() { m.classList.remove('active'); if (b) b.style.animation = ''; }, 220);
}
function escH(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ──────────────── ADVANCED GAMIFICATION (TOUR, LOFI, RECOVERY) ────────────────
function initLofi() {
    var audio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3'); 
    audio.loop = true; audio.volume = 0.4;
    var btn = document.createElement('button');
    btn.className = 'lofi-btn paused';
    btn.innerHTML = '<i class="fa-solid fa-music"></i>';
    btn.title = "موسيقى للتركيز";
    document.body.appendChild(btn);
    btn.onclick = function() {
        if(audio.paused) { audio.play(); btn.classList.remove('paused'); }
        else { audio.pause(); btn.classList.add('paused'); }
        if(navigator.vibrate) navigator.vibrate(50);
    };
}
initLofi();

function runStudentTour() {
    if(localStorage.getItem('tourStudSkipped')) return;
    var overlay = document.createElement('div'); overlay.className = 'tour-overlay';
    var cursor = document.createElement('div'); cursor.className = 'tour-cursor';
    var tooltip = document.createElement('div'); tooltip.className = 'tour-tooltip';
    var skip = document.createElement('button'); skip.className = 'tour-btn-skip'; skip.textContent = 'تخطي الشرح التجريبي';
    document.body.append(overlay, cursor, tooltip, skip);

    var steps = [
        { sel: '#student-name', txt: 'هنا تكتب اسمك بالكامل عشان نقدر نحفظ نتيجتك' },
        { sel: '#father-name', txt: 'وهنا تكتب أي بيانات إضافية طلبها المعلم كالفصل' },
        { sel: '#btn-start-exam', txt: 'بعدها اضغط هنا لتبدأ تجربة الامتحان الآمن!' }
    ];
    var current = 0; var timerId;
    function showStep() {
        if(current >= steps.length) return endTour();
        var el = document.querySelector(steps[current].sel);
        if(!el) { current++; showStep(); return; }
        overlay.classList.add('active');
        
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            var r = el.getBoundingClientRect();
            // Offset slightly to point at the center
            cursor.style.opacity = '1'; 
            cursor.style.top = (r.top + r.height/2 - 10) + 'px'; 
            cursor.style.left = (r.left + r.width/2 - 10) + 'px';
            
            tooltip.innerHTML = steps[current].txt + '<br><div style="margin-top:12px;text-align:left;"><button class="btn btn-accent" id="tour-next-btn" style="padding:4px 12px;font-size:0.8rem;border-radius:99px;">التالي <i class="fa-solid fa-arrow-left"></i></button></div>';
            tooltip.classList.remove('show');
            
            setTimeout(()=> {
                cursor.classList.add('click');
                setTimeout(()=> cursor.classList.remove('click'), 200);
                
                tooltip.className = 'tour-tooltip ' + (r.top > window.innerHeight/2 ? 'top' : 'bottom');
                // Adjust tooltip position to not cover the element
                tooltip.style.top = (r.top > window.innerHeight/2 ? (r.top - tooltip.offsetHeight - 20) : (r.bottom + 20)) + 'px';
                tooltip.style.left = (r.left + r.width/2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.classList.add('show');
                
                document.getElementById('tour-next-btn').onclick = function() {
                    tooltip.classList.remove('show');
                    current++; showStep();
                };
            }, 900);
        }, 500); // give time for scroll
    }
    function endTour() {
        localStorage.setItem('tourStudSkipped', '1');
        overlay.classList.remove('active'); cursor.style.opacity = '0'; tooltip.classList.remove('show'); skip.style.display = 'none';
        setTimeout(()=> { overlay.remove(); cursor.remove(); tooltip.remove(); skip.remove(); }, 500);
    }
    skip.onclick = endTour;
    setTimeout(showStep, 1000);
}
// Automatically start tour after 1 second if step 2 is active or immediately on load
setTimeout(runStudentTour, 1500);

// ──────────────── FORCE MOBILE LANDSCAPE ────────────────
function checkOrientation() {
    if(window.innerWidth <= 900 && window.innerHeight > window.innerWidth) {
        document.getElementById('force-landscape').classList.add('active');
    } else {
        document.getElementById('force-landscape').classList.remove('active');
    }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
checkOrientation(); // Run initially

document.getElementById('btn-force-landscape').addEventListener('click', async function() {
    try {
        var el = document.documentElement;
        if(el.requestFullscreen) await el.requestFullscreen();
        else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        
        if(screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
        document.getElementById('force-landscape').classList.remove('active');
    } catch(err) {
        // Fallback or user denial
        document.getElementById('force-landscape').classList.remove('active');
        toast('يرجى تدوير شاشة الهاتف يدوياً.', 'error');
    }
});

// Override pickAnswer to save to localStorage (Session Recovery)
var originalPick = pickAnswer;
pickAnswer = function(qi, oi) {
    if(navigator.vibrate) navigator.vibrate(40); // Haptic
    originalPick(qi, oi);
    localStorage.setItem('examRecovery_'+examId, JSON.stringify(answers));
};

// Override Timer to add dynamic danger background
var originalUpdateTimer = updateTimer;
updateTimer = function() {
    originalUpdateTimer();
    var r = remaining();
    if(r > 0 && r <= 60000 && !document.getElementById('exam-ui').classList.contains('danger-bg')) {
        document.getElementById('exam-ui').classList.add('danger-bg');
    }
};

// Override doStrike for harsh vibrations
var originalDoStrike = doStrike;
doStrike = function() {
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]);
    originalDoStrike();
};
