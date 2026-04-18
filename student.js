import { db, ref, set, push, get, update } from './firebase-config.js';

var examId = null;
var examData = null;
var attemptId = null;
var curQ = 0;
var answers = {};
var strikes = 0;
var timerInt = null;
var startMs = 0;
var durMs = 0;
var stuInfo = {};
var done = false;
var acOn = false;

document.addEventListener('DOMContentLoaded', function() {
    examId = new URLSearchParams(location.search).get('id');
    if (!examId) {
        showErr('رابط غلط — مفيش كود امتحان');
        return;
    }
    loadExam();
    bindEvts();
});

function bindEvts() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-prev').addEventListener('click', prevQ);
    document.getElementById('btn-next').addEventListener('click', nextQ);
    document.getElementById('btn-submit').addEventListener('click', function() { openM('modal-submit'); });
    document.getElementById('btn-final-sub').addEventListener('click', function() { submitExam('submitted'); });
    document.getElementById('btn-cancel-sub').addEventListener('click', function() { closeM('modal-submit'); });
    document.getElementById('modal-submit-x').addEventListener('click', function() { closeM('modal-submit'); });
    document.getElementById('btn-dismiss-warn').addEventListener('click', dismissWarn);
    document.getElementById('modal-submit').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeM('modal-submit');
    });
}

async function loadExam() {
    showLoad(true);
    try {
        var s = await get(ref(db, 'exams/' + examId));
        if (!s.exists()) {
            showLoad(false);
            showErr('الامتحان مش موجود أو تم حذفه');
            return;
        }
        examData = s.val();
        document.getElementById('login-exam-title').textContent = examData.title;
        document.getElementById('visual-exam-title').textContent = examData.title;
        document.getElementById('mobile-exam-title').textContent = examData.title;
        document.title = 'الامتحان — ' + examData.title;
        showLoad(false);
    } catch (e) {
        console.error(e);
        showLoad(false);
        showErr('مشكلة في التحميل — تأكد من الاتصال');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    var nm = document.getElementById('student-name').value.trim();
    var fa = document.getElementById('father-name').value.trim();
    if (!nm || !fa) return;

    var btn = document.getElementById('btn-start-exam');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;"></div> جاري التحقق...';

    try {
        var ip = await getIP();
        var fp = genFP();
        stuInfo = { studentName: nm, fatherName: fa, ip: ip, fingerprint: fp };

        var prev = await hasPrev(ip, fp);
        if (prev) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول الامتحان';
            showLoginErr('أنت خدت الامتحان ده قبل كده. مينفعش تدخل تاني.');
            return;
        }

        await startExam();
    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول الامتحان';
        showLoginErr('حصل مشكلة — حاول تاني');
    }
}

async function getIP() {
    try {
        var r = await fetch('https://api.ipify.org?format=json');
        var d = await r.json();
        return d.ip;
    } catch (e) {
        return 'unknown-' + Date.now();
    }
}

function genFP() {
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d');
    cx.textBaseline = 'top';
    cx.font = '14px Arial';
    cx.fillText('fp-2024', 2, 2);
    var cd = cv.toDataURL();
    var parts = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, screen.colorDepth, new Date().getTimezoneOffset(), navigator.hardwareConcurrency || '', cd.slice(-50)];
    var h = 0;
    var s = parts.join('|');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) & 0xFFFFFFFF;
    return 'FP-' + Math.abs(h).toString(36).toUpperCase();
}

async function hasPrev(ip, fp) {
    try {
        var s = await get(ref(db, 'attempts/' + examId));
        if (!s.exists()) return false;
        var all = s.val();
        for (var k in all) {
            if (all[k].fingerprint === fp || all[k].ip === ip) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function startExam() {
    startMs = Date.now();
    durMs = examData.duration * 60 * 1000;

    var aRef = push(ref(db, 'attempts/' + examId));
    attemptId = aRef.key;

    await set(aRef, {
        studentName: stuInfo.studentName,
        fatherName: stuInfo.fatherName,
        ip: stuInfo.ip,
        fingerprint: stuInfo.fingerprint,
        startTime: startMs,
        endTime: null,
        status: 'in-progress',
        strikes: 0,
        score: 0,
        totalQuestions: examData.questions.length,
        answers: {}
    });

    await logEv('exam-start', 'started');

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('exam-ui').classList.add('active');
    document.getElementById('exam-title-bar').textContent = examData.title;

    reqFS();
    initAC();
    startTimer();
    renderQ(0);
}

function startTimer() {
    updateTimer();
    timerInt = setInterval(function() {
        updateTimer();
        if (remaining() <= 0) {
            clearInterval(timerInt);
            submitExam('submitted');
        }
    }, 1000);
}

function remaining() {
    return durMs - (Date.now() - startMs);
}

function updateTimer() {
    var r = Math.max(0, remaining());
    var sec = Math.ceil(r / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    document.getElementById('timer-val').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    document.getElementById('timer-box').classList.toggle('danger', sec <= 60);
}

function renderQ(i) {
    var q = examData.questions[i];
    curQ = i;
    var tot = examData.questions.length;

    var card = document.getElementById('q-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = '';

    document.getElementById('q-label').innerHTML = '<i class="fa-solid fa-circle-question"></i> السؤال ' + (i + 1) + ' من ' + tot;
    document.getElementById('q-txt').textContent = q.text;

    var optsEl = document.getElementById('q-opts');
    var labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    optsEl.innerHTML = '';

    q.options.forEach(function(opt, oi) {
        var picked = answers[i] === oi;
        var div = document.createElement('div');
        div.className = 'ans-opt ' + (picked ? 'picked' : '');
        div.innerHTML = '<div class="ans-marker">' + labels[oi] + '</div><span>' + escH(opt) + '</span>';
        div.addEventListener('click', function() { pickAns(i, oi); });
        optsEl.appendChild(div);
    });

    document.getElementById('prog-fill').style.width = (((i + 1) / tot) * 100) + '%';
    document.getElementById('prog-txt').textContent = 'السؤال ' + (i + 1) + ' من ' + tot;

    document.getElementById('btn-prev').style.visibility = i === 0 ? 'hidden' : 'visible';

    if (i === tot - 1) {
        document.getElementById('btn-next').classList.add('hidden');
        document.getElementById('btn-submit').classList.remove('hidden');
    } else {
        document.getElementById('btn-next').classList.remove('hidden');
        document.getElementById('btn-submit').classList.add('hidden');
    }
}

function pickAns(qi, oi) {
    answers[qi] = oi;
    renderQ(qi);
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { answers: answers }).catch(console.error);
}

function nextQ() {
    if (curQ < examData.questions.length - 1) renderQ(curQ + 1);
}

function prevQ() {
    if (curQ > 0) renderQ(curQ - 1);
}

async function submitExam(status) {
    if (done) return;
    done = true;
    acOn = false;
    clearInterval(timerInt);
    closeM('modal-submit');

    var score = 0;
    examData.questions.forEach(function(q, i) {
        if (answers[i] === q.correctAnswer) score++;
    });

    try {
        await update(ref(db, 'attempts/' + examId + '/' + attemptId), {
            endTime: Date.now(),
            status: status,
            score: score,
            strikes: strikes,
            answers: answers
        });
        await logEv(status === 'cheated' ? 'auto-submit' : 'exam-submit', status);
    } catch (e) {
        console.error(e);
    }

    document.getElementById('exam-ui').classList.remove('active');
    var ds = document.getElementById('done-screen');
    ds.classList.add('active');

    var ic = document.getElementById('done-ic');
    var ti = document.getElementById('done-title');
    var tx = document.getElementById('done-text');

    if (status === 'cheated') {
        ic.className = 'done-ic cheat';
        ic.innerHTML = '<i class="fa-solid fa-ban"></i>';
        ti.textContent = 'تم تسليم الامتحان تلقائياً';
        ti.style.color = 'var(--red)';
        tx.textContent = 'تم رصد محاولة غش وتسجيلها.';
    } else {
        ic.className = 'done-ic ok';
        ic.innerHTML = '<i class="fa-solid fa-check"></i>';
        ti.textContent = 'تم التسليم!';
        tx.textContent = 'درجتك: ' + score + ' من ' + examData.questions.length + '. يمكنك إغلاق الصفحة.';
    }

    exitFS();
}

function initAC() {
    acOn = true;
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFSC);
    document.addEventListener('webkitfullscreenchange', onFSC);
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12') e.preventDefault();
        if (e.ctrlKey && e.shiftKey && e.key === 'I') e.preventDefault();
        if (e.ctrlKey && e.key === 'u') e.preventDefault();
        if (e.key === 'PrintScreen') e.preventDefault();
    });
    document.addEventListener('copy', function(e) { e.preventDefault(); });
    document.addEventListener('paste', function(e) { e.preventDefault(); });
}

function onVis() {
    if (!acOn || done) return;
    if (document.hidden) {
        logEv('tab-switch', 'left');
        doStrike();
    } else {
        logEv('tab-return', 'returned');
    }
}

function onBlur() {
    if (!acOn || done) return;
    logEv('blur', 'blur');
}

function onFSC() {
    if (!acOn || done) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        logEv('fullscreen-exit', 'exited');
        doStrike();
    }
}

function doStrike() {
    if (!acOn || done) return;
    strikes++;
    update(ref(db, 'attempts/' + examId + '/' + attemptId), { strikes: strikes }).catch(console.error);
    logEv('strike', String(strikes));
    if (strikes >= 2) {
        submitExam('cheated');
    } else {
        document.getElementById('warn-screen').classList.add('active');
    }
}

function dismissWarn() {
    document.getElementById('warn-screen').classList.remove('active');
    reqFS();
}

function reqFS() {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function() {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
}

function exitFS() {
    if (document.exitFullscreen) document.exitFullscreen().catch(function() {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

async function logEv(type, details) {
    if (!attemptId) return;
    try {
        await set(push(ref(db, 'attempts/' + examId + '/' + attemptId + '/logs')), {
            type: type,
            details: details || '',
            timestamp: Date.now()
        });
    } catch (e) {
        console.error(e);
    }
}

function showLoad(v) {
    document.getElementById('load-overlay').classList.toggle('active', v);
}

function showErr(m) {
    document.getElementById('login-exam-title').textContent = m;
    document.getElementById('login-exam-title').style.color = 'var(--red)';
    document.getElementById('visual-exam-title').textContent = m;
    document.getElementById('mobile-exam-title').textContent = m;
    document.getElementById('login-form').style.display = 'none';
}

function showLoginErr(m) {
    var el = document.getElementById('login-err');
    el.textContent = m;
    el.style.display = 'block';
}

function openM(id) {
    document.getElementById(id).classList.add('active');
}

function closeM(id) {
    var m = document.getElementById(id);
    var b = m.querySelector('.modal');
    if (b) {
        b.style.animation = 'none';
        b.offsetHeight;
        b.style.animation = 'modalIn 0.25s var(--ease) reverse both';
    }
    setTimeout(function() {
        m.classList.remove('active');
        if (b) b.style.animation = '';
    }, 200);
}

function escH(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}
