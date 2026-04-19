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

document.addEventListener('DOMContentLoaded', function() {
    examId = new URLSearchParams(location.search).get('id');
    if (!examId && location.hash) examId = location.hash.replace('#', '');
    
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

        var m = document.createElement('div');
        m.className = 'modal active';
        m.style.zIndex = '99999';
        m.innerHTML = '<div class="modal-content"><h2 style="color:var(--red);margin-bottom:1rem;"><i class="fa-solid fa-shield-halved"></i> تفعيل نظام المراقبة</h2><p style="color:var(--text-2);margin-bottom:1.5rem;font-size:0.95rem;">سيتم الآن الدخول إلى الامتحان. يرجى الموافقة على الدخول في وضع ملء الشاشة (Fullscreen). أي خروج من الامتحان سيعتبر محاولة للغش وسيتم سحب الورقة تلقائياً.</p><button id="btn-fs-confirm" class="btn btn-primary" style="width:100%;justify-content:center;font-size:1.1rem;"><i class="fa-solid fa-check"></i> موافق، ابدأ الامتحان</button></div>';
        document.body.appendChild(m);

        document.getElementById('btn-fs-confirm').onclick = async function() {
            playTap();
            reqFullscreen();
            m.remove();
            btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> جاري تحضير الامتحان...';
            try {
                await initScreenCapture();
                await beginExam();
            } catch(e) {
                console.error(e);
                showLoginErr('حدث خطأ أثناء تحميل الواجهة');
            }
        };

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول وبدء الامتحان';
        showLoginErr('حصل مشكلة — حاول تاني');
        playError();
    }
}


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
        screenStream.getVideoTracks()[0].addEventListener('ended', function() { screenStream = null; });
    } catch (err) { screenStream = null; }
}

function scheduleCaptures() {
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

        var prompt = "أنت نظام مراقبة امتحانات. هذه لقطة شاشة للطالب. حلل وابحث عن أي مؤشر للغش بصرامة واختصار. الرد كالتالي:\nالحكم: [سلوك_طبيعي أو اشتباه_بالغش]\nالسبب: [الجملة]";
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

        var flagged = analysis.toLowerCase().includes('اشتباه_بالغش') || analysis.includes('اشتباه بالغش');
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

    var splitLogin = document.querySelector('.split-login');
    if(splitLogin) splitLogin.style.display = 'none';
    
    document.getElementById('exam-ui').classList.add('active');
    document.getElementById('exam-title-bar').textContent = examData.title;

    hideAvatar();
    
    var lofiBtn = document.querySelector('.lofi-btn');
    if (lofiBtn) lofiBtn.style.display = 'flex';

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
    var doneCard = document.querySelector('.done-card');

    var existingResults = document.getElementById('done-results-area');
    if (existingResults) existingResults.remove();

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
        ti.textContent = 'تم التسليم بنجاح!';
        tx.textContent = '';
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }

        var total = examData.questions.length;
        var pct = Math.round((score / total) * 100);
        var wrong = total - score;
        var circumference = 2 * Math.PI * 65;
        var offset = circumference - (circumference * pct / 100);
        var showCorrect = examData.showCorrectToStudent === true;
        var labels = ['أ','ب','ج','د','هـ','و'];

        var resultsArea = document.createElement('div');
        resultsArea.id = 'done-results-area';

        resultsArea.innerHTML = '<div class="score-ring-wrap">'
            + '<svg class="score-ring-svg" viewBox="0 0 140 140">'
            + '<circle class="score-ring-bg" cx="70" cy="70" r="65"/>'
            + '<circle class="score-ring-fill' + (pct < 50 ? ' fail' : '') + '" cx="70" cy="70" r="65" style="stroke-dasharray:' + circumference + ';stroke-dashoffset:' + circumference + ';"/>'
            + '</svg>'
            + '<div class="score-ring-text">'
            + '<div class="score-ring-pct" style="color:' + (pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + pct + '%</div>'
            + '<div class="score-ring-label">' + score + ' من ' + total + '</div>'
            + '</div></div>'
            + '<div class="results-summary">'
            + '<div class="rs-item correct-count"><i class="fa-solid fa-check"></i> صح: ' + score + '</div>'
            + '<div class="rs-item wrong-count"><i class="fa-solid fa-xmark"></i> خطأ: ' + wrong + '</div>'
            + '</div>';

        if (wrong > 0) {
            var toggleBtn = document.createElement('button');
            toggleBtn.className = 'results-toggle';
            toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> عرض الأسئلة الخطأ';
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
                var yourAnsText = sa >= 0 && sa < q.options.length ? labels[sa] + ': ' + escH(q.options[sa]) : 'لم تُجِب';
                var inner = '<div class="wq-num"><i class="fa-solid fa-xmark"></i> السؤال ' + (qi + 1) + '</div>'
                    + '<div class="wq-text">' + escH(q.text) + '</div>'
                    + '<div class="wq-your-ans"><i class="fa-solid fa-arrow-turn-down"></i> إجابتك: ' + yourAnsText + '</div>';
                if (showCorrect) {
                    inner += '<div class="wq-correct-ans"><i class="fa-solid fa-check"></i> الصحيحة: ' + labels[q.correctAnswer] + ': ' + escH(q.options[q.correctAnswer]) + '</div>';
                }
                item.innerHTML = inner;
                wqList.appendChild(item);
            });

            resultsArea.appendChild(wqList);

            toggleBtn.addEventListener('click', function() {
                if (wqList.style.display === 'none') {
                    wqList.style.display = 'flex';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> إخفاء الأسئلة';
                } else {
                    wqList.style.display = 'none';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> عرض الأسئلة الخطأ';
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
    document.addEventListener('cut', function(e) { e.preventDefault(); });

    document.addEventListener('mouseleave', function(e) {
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

function createAvatarSVG() {
    return '<svg class="avatar-svg" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">'
        + '<g class="avatar-body">'
        + '<path d="M40 140 L35 155 L50 155 L50 130" fill="#4B5563" stroke="#374151" stroke-width="2"/>'
        + '<path d="M80 140 L85 155 L70 155 L70 130" fill="#4B5563" stroke="#374151" stroke-width="2"/>'
        + '<rect x="38" y="85" width="44" height="55" rx="8" fill="#6c63ff" stroke="#5b54e0" stroke-width="2"/>'
        + '<rect x="42" y="90" width="36" height="20" rx="4" fill="rgba(255,255,255,0.15)"/>'
        + '<circle cx="60" cy="105" r="3" fill="rgba(255,255,255,0.4)"/>'
        + '</g>'
        + '<g class="avatar-arm-left">'
        + '<path d="M42 92 L25 115 L30 118 L45 98" fill="#6c63ff" stroke="#5b54e0" stroke-width="2" stroke-linejoin="round"/>'
        + '<circle cx="27" cy="117" r="5" fill="#fcd5b4" stroke="#e8b88a" stroke-width="1.5"/>'
        + '</g>'
        + '<g class="avatar-arm-right">'
        + '<path d="M78 92 L95 110 L90 114 L75 98" fill="#6c63ff" stroke="#5b54e0" stroke-width="2" stroke-linejoin="round"/>'
        + '<circle cx="93" cy="112" r="5" fill="#fcd5b4" stroke="#e8b88a" stroke-width="1.5"/>'
        + '</g>'
        + '<circle cx="60" cy="55" r="30" fill="#fcd5b4" stroke="#e8b88a" stroke-width="2"/>'
        + '<path d="M35 42 Q35 18 60 18 Q85 18 85 42 L82 50 Q75 38 60 35 Q45 38 38 50 Z" fill="#1f2937" stroke="#111827" stroke-width="1.5"/>'
        + '<path d="M30 42 Q28 35 35 32" stroke="#1f2937" stroke-width="4" stroke-linecap="round" fill="none"/>'
        + '<path d="M90 42 Q92 35 85 32" stroke="#1f2937" stroke-width="4" stroke-linecap="round" fill="none"/>'
        + '<g class="avatar-eyes" style="transform-origin: 60px 52px">'
        + '<ellipse cx="48" cy="52" rx="4" ry="5" fill="#1f2937"/>'
        + '<ellipse cx="72" cy="52" rx="4" ry="5" fill="#1f2937"/>'
        + '<circle cx="46" cy="50" r="1.5" fill="#fff"/>'
        + '<circle cx="70" cy="50" r="1.5" fill="#fff"/>'
        + '</g>'
        + '<path d="M55 60 Q60 63 65 60" stroke="#d97706" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
        + '<ellipse class="avatar-mouth" cx="60" cy="67" rx="6" ry="3" fill="#ef4444" opacity="0.8"/>'
        + '<path d="M45 42 L38 40" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M75 42 L82 40" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>'
        + '</svg>';
}

function initAvatar() {
    var container = document.createElement('div');
    container.className = 'avatar-container';
    container.id = 'platform-avatar';
    container.innerHTML = createAvatarSVG() + '<div class="avatar-speech-bubble" id="avatar-bubble"></div>';
    document.body.appendChild(container);
    return container;
}

function showAvatar(msg) {
    var av = document.getElementById('platform-avatar');
    if (!av) av = initAvatar();
    av.classList.add('show');
    if (msg) {
        av.classList.add('speaking');
        var bubble = document.getElementById('avatar-bubble');
        bubble.textContent = msg;
        bubble.classList.add('show');
    }
}

function hideAvatar() {
    var av = document.getElementById('platform-avatar');
    if (!av) return;
    av.classList.remove('show', 'speaking');
    var bubble = document.getElementById('avatar-bubble');
    if (bubble) bubble.classList.remove('show');
}

function avatarSay(msg) {
    var av = document.getElementById('platform-avatar');
    if (!av) av = initAvatar();
    av.classList.add('show', 'speaking');
    var bubble = document.getElementById('avatar-bubble');
    bubble.textContent = msg;
    bubble.classList.add('show');
}

function avatarStopSpeaking() {
    var av = document.getElementById('platform-avatar');
    if (!av) return;
    av.classList.remove('speaking');
    var bubble = document.getElementById('avatar-bubble');
    if (bubble) bubble.classList.remove('show');
}

function runStudentTour() {
    if(localStorage.getItem('tourStudSkipped2')) return;

    var overlay = document.createElement('div');
    overlay.className = 'tour-spotlight-overlay';
    overlay.innerHTML = '<svg><defs><mask id="tour-mask"><rect width="100%" height="100%" fill="white"/><rect id="tour-hole" rx="14" ry="14" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)"/></svg>';

    var ring = document.createElement('div');
    ring.className = 'tour-spotlight-ring';

    var tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip-v2';

    document.body.append(overlay, ring, tooltip);

    var av = document.getElementById('platform-avatar');
    if (!av) av = initAvatar();
    av.classList.add('tour-mode');

    var steps = [
        { sel: '#btn-next-step', txt: 'أهلاً بك! 👋 اضغط هنا للانتقال لخطوة البيانات', avatar: 'مرحباً! أنا هساعدك تفهم المنصة' },
        { sel: '#student-name', txt: 'هنا اكتب اسمك الكامل كما هو مسجل عند المعلم', avatar: 'اكتب اسمك هنا بالظبط' },
        { sel: '#father-name', txt: 'وهنا اكتب الصف أو الشعبة حسب ما طلب المعلم', avatar: 'الصف أو الشعبة بتاعتك' },
        { sel: '#btn-start-exam', txt: 'بعد ما تملأ البيانات، اضغط هنا لبدء الامتحان في وضع ملء الشاشة', avatar: 'كده تبدأ الامتحان!' },
        { sel: 'a[href="policy.html"]', txt: 'هنا تقدر تقرأ سياسة الأمان والخصوصية قبل ما تبدأ', avatar: 'مهم تعرف سياسة الأمان' }
    ];

    var isStep2Visible = !document.getElementById('step-2').classList.contains('hidden');
    if (!isStep2Visible) {
        steps = [
            { sel: '#btn-next-step', txt: 'أهلاً بك! 👋 اضغط "التالي" للانتقال لخطوة إدخال بياناتك', avatar: 'مرحباً! خلينا نبدأ' }
        ];
    }

    var current = 0;

    function positionElements() {
        if (current >= steps.length) return endTour();
        var el = document.querySelector(steps[current].sel);
        if (!el || !el.offsetParent && el.closest('.hidden')) { current++; positionElements(); return; }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(function() {
            var r = el.getBoundingClientRect();
            var pad = 10;
            var hx = r.left - pad, hy = r.top - pad, hw = r.width + pad * 2, hh = r.height + pad * 2;

            var hole = document.getElementById('tour-hole');
            hole.setAttribute('x', hx);
            hole.setAttribute('y', hy);
            hole.setAttribute('width', hw);
            hole.setAttribute('height', hh);

            ring.style.top = hy + 'px';
            ring.style.left = hx + 'px';
            ring.style.width = hw + 'px';
            ring.style.height = hh + 'px';

            overlay.classList.add('active');

            var dotsHtml = '<div class="tour-steps-dots">';
            for (var d = 0; d < steps.length; d++) {
                dotsHtml += '<div class="tour-dot' + (d < current ? ' done' : '') + (d === current ? ' active' : '') + '"></div>';
            }
            dotsHtml += '</div>';

            var isLast = current === steps.length - 1;
            tooltip.innerHTML = dotsHtml
                + '<div class="tour-msg">' + steps[current].txt + '</div>'
                + '<div class="tour-btns">'
                + '<button class="tour-btn-next">' + (isLast ? '<i class="fa-solid fa-check"></i> فهمت!' : 'التالي <i class="fa-solid fa-arrow-left"></i>') + '</button>'
                + '<button class="tour-btn-skip-inline">تخطي</button>'
                + '</div>';
            tooltip.classList.remove('show', 'pos-top', 'pos-bottom');
            tooltip.querySelector('.tour-btn-next').style.pointerEvents = 'auto';
            tooltip.querySelector('.tour-btn-skip-inline').style.pointerEvents = 'auto';

            var posClass = r.top > window.innerHeight / 2 ? 'pos-top' : 'pos-bottom';
            tooltip.classList.add(posClass);
            var ttTop = posClass === 'pos-top' ? (r.top - pad - 20) : (r.bottom + pad + 20);
            tooltip.style.left = Math.max(16, Math.min(window.innerWidth - 340, r.left + r.width / 2 - 160)) + 'px';

            setTimeout(function() {
                var ttH = tooltip.offsetHeight || 160;
                if (posClass === 'pos-top') ttTop = r.top - pad - ttH - 12;
                tooltip.style.top = ttTop + 'px';
                tooltip.classList.add('show');
            }, 50);

            if (steps[current].avatar) avatarSay(steps[current].avatar);

            tooltip.querySelector('.tour-btn-next').onclick = function() {
                tooltip.classList.remove('show');
                avatarStopSpeaking();
                current++;
                setTimeout(positionElements, 300);
            };
            tooltip.querySelector('.tour-btn-skip-inline').onclick = endTour;

        }, 500);
    }

    function endTour() {
        localStorage.setItem('tourStudSkipped2', '1');
        overlay.classList.remove('active');
        tooltip.classList.remove('show');
        ring.style.width = '0'; ring.style.height = '0'; ring.style.opacity = '0';
        hideAvatar();
        var avEl = document.getElementById('platform-avatar');
        if (avEl) avEl.classList.remove('tour-mode');
        setTimeout(function() { overlay.remove(); ring.remove(); tooltip.remove(); }, 500);
    }

    setTimeout(positionElements, 1000);
}
setTimeout(function() {
    initAvatar();
    showAvatar('أهلاً! جاهز للامتحان؟ 📝');
    setTimeout(function() { avatarStopSpeaking(); }, 4000);
    setTimeout(runStudentTour, 2000);
}, 1500);

var landscapeIgnored = localStorage.getItem('landscapeIgnored') === '1';

function checkOrientation() {
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
        toast('يرجى تدوير شاشة الهاتف يدوياً أو اختر الاستمرار بالوضع الطولي.', 'error');
    }
});

document.getElementById('btn-skip-landscape').addEventListener('click', function() {
    localStorage.setItem('landscapeIgnored', '1');
    landscapeIgnored = true;
    document.getElementById('force-landscape').classList.remove('active');
});

document.addEventListener('visibilitychange', function() {
    if (acOn && document.visibilityState === 'hidden' && !done) {
        doStrike();
        console.warn('Visibility Trigger: Hidden tab detected!');
    }
});

window.addEventListener('blur', function() {
    if (acOn && !done) {
       
        setTimeout(function() {
            if (document.activeElement !== document.body && !document.getElementById('modal-submit').classList.contains('active')) {
                doStrike();
                console.warn('Blur Trigger: Focus lost!');
            }
        }, 100);
    }
});

var originalPick = pickAnswer;
pickAnswer = function(qi, oi) {
    if(navigator.vibrate) navigator.vibrate(40);
    originalPick(qi, oi);
    localStorage.setItem('examRecovery_'+examId, JSON.stringify(answers));
};

var originalUpdateTimer = updateTimer;
updateTimer = function() {
    originalUpdateTimer();
    var r = remaining();
    if(r > 0 && r <= 60000 && !document.getElementById('exam-ui').classList.contains('danger-bg')) {
        document.getElementById('exam-ui').classList.add('danger-bg');
    }
};

var originalDoStrike = doStrike;
doStrike = function() {
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]);
    originalDoStrike();
};
