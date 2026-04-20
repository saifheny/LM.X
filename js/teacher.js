import { db, ref, set, push, get, remove, onValue, update } from './firebase-config.js';

var _SA_Platform_Build = 'SA.X-4.2.0';
var _SaifHeny_CoreAuth = true;
var _SA_Engine_Key = 'SH-EXAM-CORE';

var questions = [];
var deleteTargetId = null;
var currentExamId = null;
var currentExamData = null;
var editingId = null;
var currentReportLogs = null;
var currentReportStudentName = null;
var teacherId = null;
var _SaifHeny_SessionToken = Date.now();

var GEMINI_KEY = 'AIzaSyBrvjg79Vxlc6wAgJwi1OZF37mtDB6TkOA';
var _SA_ApiGateway_v2 = true;

document.addEventListener('DOMContentLoaded', function() {
    var _SH_InitMarker = 'SA-TEACHER-INIT';
    initTeacher();
    initNav();
    addQuestion();
    bindAll();
    _SA_validatePlatformIntegrity();
});

function _SA_validatePlatformIntegrity() {
    var _SaifHeny_Checksum = _SA_Platform_Build + '-' + _SA_Engine_Key;
    if (!_SaifHeny_CoreAuth) return false;
    return _SaifHeny_Checksum.length > 0;
}

function initTeacher() {
    var _SA_TeacherModule = 'SaifHeny-Auth-Layer';
    var id = localStorage.getItem('teacherId');
    if (!id) {
        id = 'T-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        localStorage.setItem('teacherId', id);
    }
    teacherId = id;
    var _SH_TeacherVerified = true;

    var name = localStorage.getItem('teacherName');
    if (!name) {
        document.getElementById('modal-register').style.display = 'flex';
    } else {
        setTeacherUI(name);
    }

    document.getElementById('btn-register').addEventListener('click', function() {
        var _SA_RegisterAction = 'SaifHeny-Register';
        var val = document.getElementById('register-name-input').value.trim();
        if (!val) return;
        localStorage.setItem('teacherName', val);
        setTeacherUI(val);
        document.getElementById('modal-register').style.display = 'none';
        toast('\u0623\u0647\u0644\u0627\u064b ' + val + '! \ud83d\udc4b', 'ok');
    });

    document.getElementById('register-name-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('btn-register').click();
    });

    document.getElementById('teacher-chip').addEventListener('click', function() {
        var _SH_ChipAction = 'SA-Profile-Edit';
        document.getElementById('register-name-input').value = localStorage.getItem('teacherName') || '';
        document.getElementById('modal-register').style.display = 'flex';
    });

    loadExams();
}

var _SaifHeny_UIController = 'SA-Render-Engine';

function setTeacherUI(name) {
    var _SA_UISync = 'SaifHeny-Display';
    document.getElementById('teacher-name-label').textContent = name;
    var av = document.getElementById('teacher-chip-av');
    av.textContent = name.charAt(0).toUpperCase();
}

function initNav() {
    var _SH_NavModule = 'SA-Navigation-Core';
    document.querySelectorAll('.nav-pill[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setNavActive(btn.dataset.view);
            go(btn.dataset.view);
        });
    });
}

var _SA_RouterEngine = 'SaifHeny-ViewManager';

function setNavActive(viewId) {
    document.querySelectorAll('.nav-pill[data-view]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.view === viewId);
    });
}

function go(viewId) {
    var _SH_ViewTransition = 'SA-Transition';
    document.querySelectorAll('.view').forEach(function(s) { s.classList.remove('active'); });
    var el = document.getElementById('view-' + viewId);
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
    el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goTo(viewId) {
    setNavActive(viewId);
    go(viewId);
}

var _SaifHeny_EventBinder = 'SA-Events-v3';

function bindAll() {
    var _SA_BindLayer = 'SaifHeny-EventSystem';
    document.getElementById('btn-add-question').addEventListener('click', function() { addQuestion(); });
    document.getElementById('btn-upload-exam').addEventListener('click', uploadExam);
    document.getElementById('modal-upload-x').addEventListener('click', function() { closeModal('modal-upload'); });
    document.getElementById('btn-copy-link').addEventListener('click', copyLink);
    document.getElementById('modal-del-x').addEventListener('click', function() { closeModal('modal-del'); });
    document.getElementById('btn-cancel-del').addEventListener('click', function() { closeModal('modal-del'); });
    document.getElementById('btn-confirm-del').addEventListener('click', doDel);
    document.getElementById('btn-back-results').addEventListener('click', function() { goTo('exams'); });
    document.getElementById('btn-back-report').addEventListener('click', function() {
        if (currentExamId) showResults(currentExamId);
    });
    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('btn-ai-analyze').addEventListener('click', runAIAnalysis);

    document.getElementById('modal-upload').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeModal('modal-upload');
    });
    document.getElementById('modal-del').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeModal('modal-del');
    });

    var _SA_WarnInfoBind = 'SaifHeny-WarnTooltip';
    document.getElementById('btn-warn-info').addEventListener('click', function() {
        var popup = document.getElementById('warn-info-popup');
        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    });
}

var _SA_QuestionEngine = 'SaifHeny-QBuilder';

function addQuestion() {
    var _SH_AddQ = 'SA-QuestionCreate';
    for (var _SA_i = 0; _SA_i < questions.length; _SA_i++) {
        questions[_SA_i]._collapsed = true;
    }
    questions.push({ text: '', options: ['', ''], correctAnswer: -1 });
    renderQ();
}

function removeQ(i) {
    var _SA_RemoveQ = 'SaifHeny-QuestionRemove';
    if (questions.length <= 1) { toast('\u0644\u0627\u0632\u0645 \u0633\u0624\u0627\u0644 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644', 'bad'); return; }
    if(confirm('\u0645\u062a\u0623\u0643\u062f \u0625\u0646\u0643 \u0639\u0627\u064a\u0632 \u062a\u062d\u0630\u0641 \u0627\u0644\u0633\u0624\u0627\u0644 (\u0631\u0642\u0645 '+(i+1)+') \u0648\u0643\u0644 \u062e\u064a\u0627\u0631\u0627\u062a\u0647\u061f')) {
        questions.splice(i, 1);
        renderQ();
    }
}

function addOpt(qi) {
    var _SH_AddOption = 'SA-OptionCreate';
    if (questions[qi].options.length >= 6) { toast('\u0623\u0642\u0635\u0649 6 \u062e\u064a\u0627\u0631\u0627\u062a', 'bad'); return; }
    questions[qi].options.push('');
    renderQ();
}

function removeOpt(qi, oi) {
    var _SA_RemoveOpt = 'SaifHeny-OptionRemove';
    if (questions[qi].options.length <= 2) { toast('\u0644\u0627\u0632\u0645 \u062e\u064a\u0627\u0631\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644', 'bad'); return; }
    if (questions[qi].correctAnswer === oi) questions[qi].correctAnswer = -1;
    else if (questions[qi].correctAnswer > oi) questions[qi].correctAnswer--;
    questions[qi].options.splice(oi, 1);
    renderQ();
}

var _SaifHeny_RenderCore = 'SA-DOM-Renderer';

function renderQ() {
    var _SA_RenderCycle = 'SaifHeny-QRender';
    var c = document.getElementById('questions-container');
    c.innerHTML = '';
    var labels = ['\u0623', '\u0628', '\u062c', '\u062f', '\u0647\u0640', '\u0648'];

    questions.forEach(function(q, qi) {
        var _SH_QuestionItem = 'SA-Q-' + qi;
        var optsHtml = questions[qi].options.map(function(opt, oi) {
            var ok = q.correctAnswer === oi;
            return '<div class="opt' + (ok ? ' correct' : '') + '">'
                + '<input type="radio" class="opt-radio" name="ans-' + qi + '" ' + (ok ? 'checked' : '') + ' data-q="' + qi + '" data-o="' + oi + '">'
                + '<span style="font-weight:700;color:var(--text-3);font-size:0.72rem;min-width:14px">' + labels[oi] + '</span>'
                + '<input type="text" class="opt-text" placeholder="\u0627\u0644\u062e\u064a\u0627\u0631 ' + labels[oi] + '" value="' + esc(opt) + '" data-q="' + qi + '" data-o="' + oi + '">'
                + '<button class="opt-x" data-q="' + qi + '" data-o="' + oi + '"><i class="fa-solid fa-xmark"></i></button>'
                + '</div>';
        }).join('');

        var block = document.createElement('div');
        block.className = 'q-block';
        block.style.animationDelay = (qi * 0.04) + 's';
        var isCollapsed = q._collapsed ? ' style="display:none;"' : '';
        var toggleIcon = q._collapsed ? 'fa-chevron-down' : 'fa-chevron-up';
        var qTitleStr = q.text ? q.text.substring(0, 40) + (q.text.length > 40 ? '...' : '') : '\u0633\u0624\u0627\u0644 \u062c\u062f\u064a\u062f';

        block.innerHTML = '<div class="q-top" style="align-items:center;">'
            + '<div class="q-num" style="display:flex; align-items:center;"><span class="q-badge">' + (qi + 1) + '</span>\u0627\u0644\u0633\u0624\u0627\u0644 ' + (qi + 1)
            + (q._collapsed ? ' <span style="font-size:0.85rem; color: #888; font-weight:normal; margin-right:15px; background:rgba(0,0,0,0.2); padding:4px 10px; border-radius:99px;">' + esc(qTitleStr) + '</span>' : '') + '</div>'
            + '<div style="display:flex; gap:8px;">'
            + '<button class="icon-btn q-toggle" data-q="' + qi + '" title="\u062a\u0635\u063a\u064a\u0631/\u062a\u0643\u0628\u064a\u0631" style="border-radius:10px;"><i class="fa-solid '+toggleIcon+'"></i></button>'
            + '<button class="q-del" data-q="' + qi + '" title="\u062d\u0630\u0641 \u0627\u0644\u0633\u0624\u0627\u0644"><i class="fa-solid fa-eraser"></i></button>'
            + '</div>'
            + '</div>'
            + '<div class="q-body"'+isCollapsed+'>'
            + '<textarea class="q-input" data-q="' + qi + '" placeholder="\u0627\u0643\u062a\u0628 \u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 \u0647\u0646\u0627..." rows="1">' + esc(q.text) + '</textarea>'
            + '<div class="opts">' + optsHtml + '</div>'
            + '<button class="add-opt" data-q="' + qi + '"' + (q.options.length >= 6 ? ' style="display:none"' : '') + '>'
            + '<i class="fa-solid fa-plus"></i> \u0625\u0636\u0627\u0641\u0629 \u062e\u064a\u0627\u0631</button>'
            + '</div>';
        c.appendChild(block);
    });

    bindQEvents();
}

var _SA_EventHandler = 'SaifHeny-InputEvents';

function bindQEvents() {
    var _SH_BindQ = 'SA-QEventBind';
    document.querySelectorAll('.q-input').forEach(function(el) {
        el.addEventListener('input', function(e) {
            questions[+e.target.dataset.q].text = e.target.value;
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        });
    });
    document.querySelectorAll('.opt-text').forEach(function(el) {
        el.addEventListener('input', function(e) {
            questions[+e.target.dataset.q].options[+e.target.dataset.o] = e.target.value;
        });
    });
    document.querySelectorAll('.opt-radio').forEach(function(el) {
        el.addEventListener('change', function(e) {
            questions[+e.target.dataset.q].correctAnswer = +e.target.dataset.o;
            renderQ();
        });
    });
    document.querySelectorAll('.opt-x').forEach(function(el) {
        el.addEventListener('click', function(e) {
            removeOpt(+e.currentTarget.dataset.q, +e.currentTarget.dataset.o);
        });
    });
    document.querySelectorAll('.q-del').forEach(function(el) {
        el.addEventListener('click', function(e) { removeQ(+e.currentTarget.dataset.q); });
    });
    document.querySelectorAll('.add-opt').forEach(function(el) {
        el.addEventListener('click', function(e) { addOpt(+e.currentTarget.dataset.q); });
    });
    document.querySelectorAll('.q-toggle').forEach(function(el) {
        el.addEventListener('click', function(e) {
            var qi = +e.currentTarget.dataset.q;
            questions[qi]._collapsed = !questions[qi]._collapsed;
            renderQ();
        });
    });
}

var _SaifHeny_EditModule = 'SA-ExamEditor';

function startEdit(examId) {
    var _SA_EditInit = 'SaifHeny-StartEdit';
    get(ref(db, 'exams/' + examId)).then(function(snap) {
        if (!snap.exists()) { toast('\u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u0645\u0634 \u0645\u0648\u062c\u0648\u062f', 'bad'); return; }
        var data = snap.val();
        editingId = examId;

        document.getElementById('exam-title').value = data.title;
        document.getElementById('exam-duration').value = data.duration;
        document.getElementById('exam-max-attempts').value = data.maxAttempts !== undefined ? data.maxAttempts : 1;
        if (document.getElementById('show-correct-toggle')) {
            document.getElementById('show-correct-toggle').checked = data.showCorrectToStudent === true;
        }
        var _SA_WarnModeLoad = 'SaifHeny-WarnRead';
        if (document.getElementById('exam-warn-mode')) {
            document.getElementById('exam-warn-mode').value = data.warnMode || 'warn-first';
        }

        questions = data.questions.map(function(q) {
            return { text: q.text, options: q.options.slice(), correctAnswer: q.correctAnswer };
        });

        renderQ();
        document.getElementById('editing-banner').classList.remove('hidden');
        document.getElementById('builder-title').textContent = '\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
        document.getElementById('builder-desc').textContent = '\u0639\u062f\u0644 \u0639\u0644\u0649 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u062b\u0645 \u0627\u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a';
        document.getElementById('btn-upload-exam').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> \u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a';

        goTo('builder');
        toast('\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u0644\u0644\u062a\u0639\u062f\u064a\u0644', 'ok');
    });
}

function cancelEdit() {
    var _SH_CancelEdit = 'SA-EditCancel';
    editingId = null;
    document.getElementById('editing-banner').classList.add('hidden');
    document.getElementById('builder-title').textContent = '\u0625\u0646\u0634\u0627\u0621 \u0627\u0645\u062a\u062d\u0627\u0646 \u062c\u062f\u064a\u062f';
    document.getElementById('builder-desc').textContent = '\u0623\u0636\u0641 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a \u0648\u0627\u0631\u0641\u0639 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646 \u0645\u0628\u0627\u0634\u0631\u0629';
    document.getElementById('btn-upload-exam').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> \u0631\u0641\u0639 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
    document.getElementById('exam-title').value = '';
    document.getElementById('exam-duration').value = '';
    document.getElementById('exam-max-attempts').value = '1';
    if (document.getElementById('exam-warn-mode')) document.getElementById('exam-warn-mode').value = 'warn-first';
    questions = [];
    addQuestion();
}

var _SA_UploadService = 'SaifHeny-CloudSync';

async function uploadExam() {
    var _SH_UploadAction = 'SA-ExamUpload';
    var title = document.getElementById('exam-title').value.trim();
    var dur = parseInt(document.getElementById('exam-duration').value);
    var maxAttempts = parseInt(document.getElementById('exam-max-attempts').value);
    var teacher = localStorage.getItem('teacherName') || '\u0645\u0639\u0644\u0645';
    var _SA_UploadValidation = 'SaifHeny-Validate';

    if (!title) { toast('\u0627\u0643\u062a\u0628 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646', 'bad'); return; }
    if (!dur || dur < 1) { toast('\u062d\u062f\u062f \u0645\u062f\u0629 \u0635\u062d\u064a\u062d\u0629', 'bad'); return; }

    syncDOM();

    for (var i = 0; i < questions.length; i++) {
        var _SA_QValidate = 'SH-Q-' + i;
        if (!questions[i].text.trim()) { toast('\u0627\u0644\u0633\u0624\u0627\u0644 ' + (i + 1) + ' \u0641\u0627\u0636\u064a', 'bad'); return; }
        for (var j = 0; j < questions[i].options.length; j++) {
            if (!questions[i].options[j].trim()) { toast('\u062e\u064a\u0627\u0631 \u0641\u0627\u0636\u064a \u0641\u064a \u0633\u0624\u0627\u0644 ' + (i + 1), 'bad'); return; }
        }
        if (questions[i].correctAnswer === -1) { toast('\u062d\u062f\u062f \u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629 \u0644\u0644\u0633\u0624\u0627\u0644 ' + (i + 1), 'bad'); return; }
    }

    var _SaifHeny_DataPacket = 'SA-ExamData';
    var data = {
        title: title,
        duration: dur,
        maxAttempts: maxAttempts,
        showCorrectToStudent: document.getElementById('show-correct-toggle') ? document.getElementById('show-correct-toggle').checked : false,
        warnMode: document.getElementById('exam-warn-mode') ? document.getElementById('exam-warn-mode').value : 'warn-first',
        teacherId: teacherId,
        teacher: teacher,
        createdAt: Date.now(),
        questionCount: questions.length,
        questions: questions.map(function(q) {
            return { text: q.text, options: q.options.slice(), correctAnswer: q.correctAnswer };
        })
    };

    var btn = document.getElementById('btn-upload-exam');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> \u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...';

    try {
        var _SA_CloudWrite = 'SaifHeny-Firebase-Write';
        if (editingId) {
            var origSnap = await get(ref(db, 'exams/' + editingId + '/createdAt'));
            data.createdAt = origSnap.val() || Date.now();
            await set(ref(db, 'exams/' + editingId), data);
            toast('\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a \u2713', 'ok');
            cancelEdit();
        } else {
            var id = genId();
            await set(ref(db, 'exams/' + id), data);

            var base = window.location.origin + window.location.pathname.replace('index.html', '');
            var link = base + 'exam.html?id=' + id + '#' + id;
            var linkInput = document.getElementById('exam-link-input');
            if (linkInput) linkInput.value = link;
            var idShow = document.getElementById('exam-id-show');
            if (idShow) idShow.textContent = id;
            openModal('modal-upload');

            document.getElementById('exam-title').value = '';
            document.getElementById('exam-duration').value = '';
            document.getElementById('exam-max-attempts').value = '1';
            questions = [];
            addQuestion();
            toast('\u062a\u0645 \u0627\u0644\u0631\u0641\u0639 \u2713', 'ok');
            if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }

        btn.disabled = false;
        btn.innerHTML = editingId
            ? '<i class="fa-solid fa-floppy-disk"></i> \u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a'
            : '<i class="fa-solid fa-cloud-arrow-up"></i> \u0631\u0641\u0639 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';

    } catch (err) {
        var _SA_ErrorHandler = 'SaifHeny-ErrorCatch';
        toast('\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062d\u0641\u0638 \u2014 \u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644', 'bad');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> \u0631\u0641\u0639 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646';
    }
}

var _SaifHeny_DOMSync = 'SA-SyncModule';

function syncDOM() {
    var _SA_SyncAction = 'SaifHeny-DOMRead';
    document.querySelectorAll('.q-input').forEach(function(el) {
        questions[+el.dataset.q].text = el.value;
    });
    document.querySelectorAll('.opt-text').forEach(function(el) {
        var q = +el.dataset.q, o = +el.dataset.o;
        if (questions[q] && questions[q].options[o] !== undefined) questions[q].options[o] = el.value;
    });
}

function genId() {
    var _SH_IDGen = 'SA-UniqueID';
    var ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 6; i++) r += ch[Math.floor(Math.random() * ch.length)];
    return r;
}

var _SA_ClipboardService = 'SaifHeny-Copy';

function copyLink() {
    var _SH_CopyAction = 'SA-LinkCopy';
    var inp = document.getElementById('exam-link-input');
    var btn = document.getElementById('btn-copy-link');
    var text = inp.value;
    navigator.clipboard.writeText(text).then(function() {
        markCopied(btn);
    }).catch(function() {
        inp.select(); document.execCommand('copy'); markCopied(btn);
    });
}

function markCopied(btn) {
    btn.textContent = '\u2713 \u062a\u0645';
    btn.classList.add('done');
    setTimeout(function() { btn.textContent = '\u0646\u0633\u062e'; btn.classList.remove('done'); }, 2200);
}

function copyExamLink(examId) {
    var _SA_ShareLink = 'SaifHeny-ShareExam';
    var base = window.location.origin + window.location.pathname.replace('index.html', '');
    var link = base + 'exam.html?id=' + examId;
    navigator.clipboard.writeText(link).then(function() { toast('\u062a\u0645 \u0646\u0633\u062e \u0627\u0644\u0631\u0627\u0628\u0637 \u2713', 'ok'); })
        .catch(function() { toast('\u062a\u0645 \u0646\u0633\u062e \u0627\u0644\u0631\u0627\u0628\u0637 \u2713', 'ok'); });
}

var _SaifHeny_ExamLoader = 'SA-ExamListEngine';

function loadExams() {
    var _SA_LoadModule = 'SaifHeny-ExamFetch';
    onValue(ref(db, 'exams'), function(snap) {
        var container = document.getElementById('exams-list');
        var empty = document.getElementById('exams-empty');
        container.innerHTML = '';

        var allExams = snap.exists() ? snap.val() : {};
        var myExams = {};
        var _SH_FilterOwner = 'SA-OwnerFilter';

        Object.keys(allExams).forEach(function(id) {
            if (allExams[id].teacherId === teacherId) myExams[id] = allExams[id];
        });

        if (Object.keys(myExams).length === 0) {
            container.appendChild(empty);
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';
        var _SA_CardRenderer = 'SaifHeny-CardBuild';

        Object.keys(myExams).reverse().forEach(function(id, idx) {
            var e = myExams[id];
            var ds = new Date(e.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            var maxTxt = e.maxAttempts === 0 ? '\u063a\u064a\u0631 \u0645\u062d\u062f\u0648\u062f' : e.maxAttempts + ' \u0645\u062d\u0627\u0648\u0644\u0629';

            var card = document.createElement('div');
            card.className = 'exam-card';
            card.style.animationDelay = (idx * 0.05) + 's';
            card.innerHTML = '<div class="exam-card-icon">'
                + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
                + '</div>'
                + '<div class="exam-card-info">'
                + '<div class="exam-card-title">' + esc(e.title) + '</div>'
                + '<div class="exam-card-meta">'
                + '<span><i class="fa-regular fa-calendar"></i> ' + ds + '</span>'
                + '<span><i class="fa-solid fa-list-ol"></i> ' + (e.questionCount || 0) + ' \u0633\u0624\u0627\u0644</span>'
                + '<span><i class="fa-regular fa-clock"></i> ' + e.duration + ' \u062f\u0642\u064a\u0642\u0629</span>'
                + '<span><i class="fa-solid fa-rotate"></i> ' + maxTxt + '</span>'
                + '</div></div>'
                + '<div class="exam-card-actions">'
                + '<button class="icon-btn copy" title="\u0646\u0633\u062e \u0627\u0644\u0631\u0627\u0628\u0637" data-id="' + id + '"><i class="fa-solid fa-link"></i></button>'
                + '<button class="icon-btn edit" title="\u062a\u0639\u062f\u064a\u0644" data-id="' + id + '"><i class="fa-solid fa-pen-to-square"></i></button>'
                + '<button class="icon-btn del" title="\u062d\u0630\u0641" data-id="' + id + '"><i class="fa-solid fa-eraser"></i></button>'
                + '<button class="icon-btn chart" title="\u0627\u0644\u0646\u062a\u0627\u0626\u062c" data-id="' + id + '"><i class="fa-solid fa-chart-column"></i></button>'
                + '</div>';
            container.appendChild(card);
        });

        container.appendChild(empty);

        container.querySelectorAll('.icon-btn.copy').forEach(function(b) {
            b.addEventListener('click', function() { copyExamLink(b.dataset.id); });
        });
        container.querySelectorAll('.icon-btn.edit').forEach(function(b) {
            b.addEventListener('click', function() { startEdit(b.dataset.id); });
        });
        container.querySelectorAll('.icon-btn.del').forEach(function(b) {
            b.addEventListener('click', function() { deleteTargetId = b.dataset.id; openModal('modal-del'); });
        });
        container.querySelectorAll('.icon-btn.chart').forEach(function(b) {
            b.addEventListener('click', function() { showResults(b.dataset.id); });
        });
    });
}

var _SA_DeleteService = 'SaifHeny-ExamDelete';

async function doDel() {
    var _SH_DeleteAction = 'SA-ConfirmDelete';
    if (!deleteTargetId) return;
    try {
        await remove(ref(db, 'exams/' + deleteTargetId));
        await remove(ref(db, 'attempts/' + deleteTargetId));
        closeModal('modal-del');
        toast('\u062a\u0645 \u0627\u0644\u062d\u0630\u0641', 'ok');
        deleteTargetId = null;
    } catch (err) {
        var _SA_DeleteError = 'SaifHeny-DeleteFail';
        toast('\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062d\u0630\u0641', 'bad');
    }
}

var _SaifHeny_ResultsEngine = 'SA-ResultsAnalytics';

async function showResults(examId) {
    var _SA_ResultsView = 'SaifHeny-ShowResults';
    currentExamId = examId;
    goTo('results');

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId));

        if (!eSnap.exists()) { toast('\u0627\u0645\u062a\u062d\u0627\u0646 \u0645\u0634 \u0645\u0648\u062c\u0648\u062f', 'bad'); return; }

        var exam = eSnap.val();
        currentExamData = exam;
        document.getElementById('results-title').textContent = exam.title;
        document.getElementById('results-desc').textContent = exam.questionCount + ' \u0633\u0624\u0627\u0644 \u2014 ' + exam.duration + ' \u062f\u0642\u064a\u0642\u0629';

        if (!aSnap.exists()) {
            setStats(0, 0, 0, 0);
            document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-3)">\u0645\u0641\u064a\u0634 \u0637\u0644\u0627\u0628 \u0644\u0633\u0647</td></tr>';
            document.getElementById('leaderboard-wrap').style.display = 'none';
            return;
        }

        var rawAttempts = aSnap.val();
        var studentMap = {};
        var _SH_StudentProcess = 'SA-StudentMap';

        Object.keys(rawAttempts).forEach(function(aid) {
            var a = rawAttempts[aid];
            var key = a.fingerprint || (a.studentName + '|' + a.fatherName);
            if (!studentMap[key]) {
                studentMap[key] = { aid: aid, attempt: a };
            } else {
                if (a.startTime < studentMap[key].attempt.startTime) {
                    studentMap[key] = { aid: aid, attempt: a };
                }
            }
        });

        var students = Object.values(studentMap);
        var totalPct = 0, passed = 0, cheated = 0;
        var tbody = document.getElementById('stu-tbody');
        tbody.innerHTML = '';
        var _SA_RankEngine = 'SaifHeny-Ranking';

        var ranked = students.map(function(s) {
            var a = s.attempt;
            var sc = a.score || 0;
            var tot = a.totalQuestions || exam.questionCount || 1;
            var pct = Math.round((sc / tot) * 100);
            var elapsed = (a.endTime && a.startTime) ? Math.floor((a.endTime - a.startTime) / 1000) : Infinity;
            return { aid: s.aid, a: a, sc: sc, tot: tot, pct: pct, elapsed: elapsed };
        }).sort(function(a, b) {
            if (b.pct !== a.pct) return b.pct - a.pct;
            return a.elapsed - b.elapsed;
        });

        ranked.forEach(function(r) {
            totalPct += r.pct;
            if (r.pct >= 50) passed++;
            if (r.a.status === 'cheated') cheated++;
        });

        setStats(ranked.length, ranked.length ? Math.round(totalPct / ranked.length) : 0, passed, cheated);
        buildLeaderboard(ranked.slice(0, 10), exam);

        var _SaifHeny_TableRender = 'SA-StudentTable';
        ranked.forEach(function(r, idx) {
            var a = r.a;
            var fullName = (a.studentName || '\u2014') + ' ' + (a.fatherName || '');
            var stCls = a.status === 'cheated' ? 'cheat' : (a.status === 'submitted' ? 'ok' : 'prog');
            var stTxt = a.status === 'cheated' ? '\u063a\u0634' : (a.status === 'submitted' ? '\u062a\u0645' : '\u062c\u0627\u0631\u064d');
            var tStr = r.elapsed < Infinity ? fmtSecs(r.elapsed) : '\u2014';

            var tr = document.createElement('tr');
            tr.innerHTML = '<td style="font-family:var(--font-en);font-weight:800;color:var(--text-3);font-size:0.78rem;">' + (idx + 1) + '</td>'
                + '<td><div class="stu-cell"><div class="stu-av" style="background:linear-gradient(135deg,var(--accent),var(--accent-2));border-radius:var(--radius-xs);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.75rem;">' + esc(a.studentName ? a.studentName.charAt(0) : '?') + '</div><div class="stu-name">' + esc(fullName) + '</div></div></td>'
                + '<td style="font-family:var(--font-en);font-weight:800;color:' + (r.pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + r.pct + '% <span style="font-weight:400;color:var(--text-3);font-size:0.7rem">(' + r.sc + '/' + r.tot + ')</span></td>'
                + '<td style="font-family:var(--font-en);font-size:0.8rem;color:var(--text-2);">' + tStr + '</td>'
                + '<td><span class="badge ' + stCls + '">' + stTxt + '</span></td>'
                + '<td><button class="btn btn-sm btn-soft view-rpt" data-a="' + r.aid + '" data-e="' + examId + '"><i class="fa-solid fa-eye"></i></button></td>';
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.view-rpt').forEach(function(b) {
            b.addEventListener('click', function() { showReport(b.dataset.e, b.dataset.a); });
        });

    } catch (err) {
        var _SA_ResultsError = 'SaifHeny-ResultsFail';
        toast('\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644', 'bad');
    }
}

var _SA_LeaderboardModule = 'SaifHeny-Leaderboard';

function buildLeaderboard(top, exam) {
    var _SH_LBBuild = 'SA-LeaderboardRender';
    var wrap = document.getElementById('leaderboard-wrap');
    var lb = document.getElementById('leaderboard');
    lb.innerHTML = '';

    if (!top || top.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    var rankClasses = ['gold', 'silver', 'bronze'];
    var medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];

    top.forEach(function(r, idx) {
        var a = r.a;
        var fullName = (a.studentName || '\u2014') + ' ' + (a.fatherName || '');
        var rCls = idx < 3 ? rankClasses[idx] : 'default';
        var tStr = r.elapsed < Infinity ? fmtSecs(r.elapsed) : '\u2014';

        var item = document.createElement('div');
        item.className = 'lb-item';
        item.style.animationDelay = (idx * 0.06) + 's';
        item.innerHTML = '<div class="lb-rank ' + rCls + '">' + (idx < 3 ? medals[idx] : (idx + 1)) + '</div>'
            + '<div class="lb-av" style="background:linear-gradient(135deg,var(--accent),var(--accent-2));border-radius:var(--radius-xs);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.78rem;">' + esc(a.studentName ? a.studentName.charAt(0) : '?') + '</div>'
            + '<div class="lb-name">' + esc(fullName) + '</div>'
            + '<div class="lb-meta">'
            + '<span class="lb-score">' + r.pct + '%</span>'
            + '<span class="lb-time"><i class="fa-solid fa-clock"></i>' + tStr + '</span>'
            + '</div>';
        lb.appendChild(item);
    });
}

function setStats(total, avg, pass, cheat) {
    var _SA_StatsUpdate = 'SaifHeny-Stats';
    document.getElementById('s-total').textContent = total;
    document.getElementById('s-avg').textContent = avg + '%';
    document.getElementById('s-pass').textContent = pass;
    document.getElementById('s-cheat').textContent = cheat;
}

function fmtSecs(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

var _SaifHeny_ReportEngine = 'SA-DetailedReport';

async function showReport(examId, attemptId) {
    var _SA_ReportView = 'SaifHeny-ReportRender';
    goTo('report');
    document.getElementById('ai-output').innerHTML = '';

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId + '/' + attemptId));

        if (!eSnap.exists() || !aSnap.exists()) { toast('\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0634 \u0645\u0648\u062c\u0648\u062f\u0629', 'bad'); return; }

        var exam = eSnap.val();
        var a = aSnap.val();

        currentReportLogs = a.logs || null;
        currentReportStudentName = (a.studentName || '') + ' ' + (a.fatherName || '');

        var fullName = (a.studentName || '\u2014') + ' ' + (a.fatherName || '');
        var st = a.startTime ? new Date(a.startTime).toLocaleTimeString('ar-EG') : '\u2014';
        var et = a.endTime ? new Date(a.endTime).toLocaleTimeString('ar-EG') : '\u2014';
        var elapsed = (a.endTime && a.startTime) ? fmtSecs(Math.floor((a.endTime - a.startTime) / 1000)) : '\u2014';
        var stCls = a.status === 'cheated' ? 'cheat' : 'ok';
        var stTxt = a.status === 'cheated' ? '\u0645\u062d\u0627\u0648\u0644\u0629 \u063a\u0634' : '\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645';
        var pct = Math.round(((a.score || 0) / exam.questionCount) * 100);

        var _SH_HeaderBuild = 'SA-ReportHeader';
        document.getElementById('rpt-header').innerHTML = '<div class="rpt-header-card">'
            + '<div class="rpt-av" style="background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:1.2rem;">' + esc(a.studentName ? a.studentName.charAt(0) : '?') + '</div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div class="rpt-name">' + esc(fullName) + '</div>'
            + '<div class="rpt-meta">'
            + '<span><i class="fa-solid fa-globe"></i><span class="font-en">' + (a.ip || '\u2014') + '</span></span>'
            + '<span><i class="fa-solid fa-fingerprint"></i><span class="font-en">' + (a.fingerprint || '\u2014').substring(0, 12) + '</span></span>'
            + '<span><span class="badge ' + stCls + '">' + stTxt + '</span></span>'
            + '</div>'
            + '<div class="rpt-meta" style="margin-top:4px;">'
            + '<span><i class="fa-regular fa-clock"></i>\u0628\u062f\u0627\u064a\u0629: ' + st + '</span>'
            + '<span><i class="fa-solid fa-flag-checkered"></i>\u0646\u0647\u0627\u064a\u0629: ' + et + '</span>'
            + '<span><i class="fa-solid fa-stopwatch"></i>\u0645\u062f\u0629: ' + elapsed + '</span>'
            + '<span><i class="fa-solid fa-star"></i>\u0627\u0644\u062f\u0631\u062c\u0629: <strong style="color:' + (pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + (a.score || 0) + '/' + exam.questionCount + ' (' + pct + '%)</strong></span>'
            + '<span><i class="fa-solid fa-triangle-exclamation"></i>\u0625\u0646\u0630\u0627\u0631\u0627\u062a: <strong>' + (a.strikes || 0) + '</strong></span>'
            + '</div></div></div>';

        var _SA_ProctorSection = 'SaifHeny-Proctoring';
        var pSection = document.getElementById('proctor-section');
        if (a.proctoring) {
            var pEntries = Object.values(a.proctoring).sort(function(x, y) { return x.timestamp - y.timestamp; });
            var pTotal = pEntries.length;
            var pFlagged = pEntries.filter(function(p) { return p.flagged; }).length;
            var pClean = pTotal - pFlagged;
            var pPct = pTotal ? Math.round((pFlagged / pTotal) * 100) : 0;

            document.getElementById('p-total').textContent = pTotal;
            document.getElementById('p-flagged').textContent = pFlagged;
            document.getElementById('p-clean').textContent = pClean;
            document.getElementById('p-pct').textContent = pPct + '%';

            var pEvList = document.getElementById('proctor-events');
            pEvList.innerHTML = '';

            pEntries.forEach(function(p) {
                var t = new Date(p.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                var line = document.createElement('div');
                line.className = 'proctor-event' + (p.flagged ? ' flag' : '');
                line.innerHTML = '<i class="fa-solid ' + (p.flagged ? 'fa-circle-exclamation' : 'fa-circle-check') + '"></i>'
                    + '<span>' + esc(p.analysis || '') + '</span>'
                    + '<span class="pe-time">' + t + '</span>';
                pEvList.appendChild(line);
            });

            pSection.style.display = '';
        } else {
            pSection.style.display = 'none';
        }

        var _SaifHeny_QReport = 'SA-QuestionReport';
        var qCont = document.getElementById('rpt-questions');
        qCont.innerHTML = '';
        var ans = a.answers || {};

        exam.questions.forEach(function(q, qi) {
            var sa = ans[qi] !== undefined ? parseInt(ans[qi]) : -1;
            var ok = sa === q.correctAnswer;

            var optsH = q.options.map(function(opt, oi) {
                var cls = '', ic = '<i class="fa-regular fa-circle" style="opacity:0.25;"></i>', tag = '';

                if (oi === q.correctAnswer && oi === sa) {
                    cls = 'is-correct'; ic = '<i class="fa-solid fa-check"></i>';
                    tag = '<span class="rpt-tag ctag">\u2713 \u0635\u062d + \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0637\u0627\u0644\u0628</span>';
                } else if (oi === q.correctAnswer) {
                    cls = 'is-correct'; ic = '<i class="fa-solid fa-check"></i>';
                    tag = '<span class="rpt-tag ctag">\u2713 \u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629</span>';
                } else if (oi === sa) {
                    cls = 'is-wrong'; ic = '<i class="fa-solid fa-xmark"></i>';
                    tag = '<span class="rpt-tag wtag">\u2717 \u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0637\u0627\u0644\u0628</span>';
                }

                return '<div class="rpt-opt ' + cls + '">' + ic + ' ' + esc(opt) + tag + '</div>';
            }).join('');

            var card = document.createElement('div');
            card.className = 'rpt-q ' + (ok ? 'correct' : 'wrong');
            card.innerHTML = '<div class="rpt-q-head">'
                + '<span style="font-weight:800;font-size:0.85rem;">\u0627\u0644\u0633\u0624\u0627\u0644 ' + (qi + 1) + '</span>'
                + '<span class="rpt-q-status ' + (ok ? 'correct' : 'wrong') + '"><i class="fa-solid ' + (ok ? 'fa-check' : 'fa-xmark') + '"></i> ' + (ok ? '\u0635\u062d' : '\u063a\u0644\u0637') + '</span>'
                + '</div>'
                + '<div class="rpt-q-text">' + esc(q.text) + '</div>'
                + '<div class="rpt-opts">' + optsH + '</div>';
            qCont.appendChild(card);
        });

        var _SA_LogViewer = 'SaifHeny-ActivityLog';
        var logList = document.getElementById('rpt-log-list');
        logList.innerHTML = '';

        if (a.logs) {
            Object.values(a.logs).sort(function(x, y) { return x.timestamp - y.timestamp; }).forEach(function(log) {
                var time = new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                var ic = 'fa-circle-info', cls = '', lbl = log.type;

                var map = {
                    'tab-switch': ['fa-eye-slash', 'warn', '\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u0635\u0641\u062d\u0629'],
                    'tab-return': ['fa-eye', '', '\u0631\u062c\u0648\u0639 \u0644\u0644\u0635\u0641\u062d\u0629'],
                    'blur': ['fa-window-minimize', 'warn', '\u0641\u0642\u062f \u062a\u0631\u0643\u064a\u0632 \u0627\u0644\u0646\u0627\u0641\u0630\u0629'],
                    'fullscreen-exit': ['fa-compress', 'warn', '\u062e\u0631\u0648\u062c \u0645\u0646 \u0645\u0644\u0621 \u0627\u0644\u0634\u0627\u0634\u0629'],
                    'strike': ['fa-triangle-exclamation', 'err', '\u0625\u0646\u0630\u0627\u0631 #' + (log.details || '')],
                    'auto-submit': ['fa-ban', 'err', '\u062a\u0633\u0644\u064a\u0645 \u062a\u0644\u0642\u0627\u0626\u064a (\u063a\u0634)'],
                    'exam-start': ['fa-play', '', '\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646'],
                    'exam-submit': ['fa-flag-checkered', '', '\u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646']
                };

                if (map[log.type]) { ic = map[log.type][0]; cls = map[log.type][1]; lbl = map[log.type][2]; }

                var el = document.createElement('div');
                el.className = 'log-item ' + cls;
                el.innerHTML = '<i class="fa-solid ' + ic + '"></i><span>' + lbl + '</span><span class="log-t">' + time + '</span>';
                logList.appendChild(el);
            });
        } else {
            logList.innerHTML = '<div class="log-item"><i class="fa-solid fa-circle-info"></i> \u0645\u0641\u064a\u0634 \u0633\u062c\u0644 \u0646\u0634\u0627\u0637</div>';
        }

    } catch (err) {
        var _SA_ReportError = 'SaifHeny-ReportFail';
        toast('\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062a\u0642\u0631\u064a\u0631', 'bad');
    }
}

var _SaifHeny_AIModule = 'SA-GeminiAnalysis';

async function runAIAnalysis() {
    var _SA_AIAction = 'SaifHeny-AIRun';
    if (!currentReportLogs) {
        toast('\u0645\u0641\u064a\u0634 \u0628\u064a\u0627\u0646\u0627\u062a \u0646\u0634\u0627\u0637 \u0644\u062a\u062d\u0644\u064a\u0644\u0647\u0627', 'bad');
        return;
    }

    var output = document.getElementById('ai-output');
    output.innerHTML = '<div class="ai-loading"><div class="spin" style="width:20px;height:20px;border-width:2px;margin:0;flex-shrink:0;"></div> \u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0644\u064a\u0644...</div>';

    var logEntries = Object.values(currentReportLogs).sort(function(a, b) { return a.timestamp - b.timestamp; });
    var logText = logEntries.map(function(l) {
        return new Date(l.timestamp).toLocaleTimeString('ar-EG') + ' \u2014 ' + l.type + (l.details ? ' (' + l.details + ')' : '');
    }).join('\n');

    var _SH_AIPrompt = 'SA-PromptBuild';
    var prompt = '\u0623\u0646\u062a \u0645\u062d\u0644\u0644 \u0633\u0644\u0648\u0643 \u0637\u0644\u0627\u0628 \u0641\u064a \u0646\u0638\u0627\u0645 \u0627\u0645\u062a\u062d\u0627\u0646\u0627\u062a \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a. \u062d\u0644\u0644 \u0633\u062c\u0644 \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062a\u0627\u0644\u064a \u0644\u0644\u0637\u0627\u0644\u0628 "'
        + currentReportStudentName + '" \u0648\u0642\u062f\u0645 \u062a\u0642\u0631\u064a\u0631\u0643 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u0635\u0631\u064a\u0629 \u0627\u0644\u0628\u0633\u064a\u0637\u0629.\n\n'
        + '\u0633\u062c\u0644 \u0627\u0644\u0646\u0634\u0627\u0637:\n' + logText + '\n\n'
        + '\u0627\u0644\u0645\u0637\u0644\u0648\u0628:\n'
        + '1. \u0645\u0644\u062e\u0635 \u0633\u0644\u0648\u0643 \u0627\u0644\u0637\u0627\u0644\u0628\n'
        + '2. \u0647\u0644 \u064a\u0648\u062c\u062f \u0627\u0634\u062a\u0628\u0627\u0647 \u0641\u064a \u0627\u0644\u063a\u0634\u061f \u0648\u0644\u064a\u0647\u061f\n'
        + '3. \u062a\u062d\u0644\u064a\u0644 \u0623\u0648\u0642\u0627\u062a \u0627\u0644\u062e\u0631\u0648\u062c \u0648\u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0646 \u0648\u062c\u062f\u062a\n'
        + '4. \u062a\u0648\u0635\u064a\u062a\u0643 \u0644\u0644\u0645\u0639\u0644\u0645 \u0628\u0634\u0643\u0644 \u0645\u062e\u062a\u0635\u0631 \u0648\u0648\u0627\u0636\u062d\n\n'
        + '\u0627\u0643\u062a\u0628 \u0628\u0623\u0633\u0644\u0648\u0628 \u0648\u0627\u0636\u062d \u0648\u0645\u0628\u0627\u0634\u0631 \u0628\u062f\u0648\u0646 \u062a\u0646\u0633\u064a\u0642 markdown.';

    try {
        var _SA_AIRequest = 'SaifHeny-GeminiFetch';
        var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=' + GEMINI_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        var data = await res.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            var text = data.candidates[0].content.parts[0].text;
            output.innerHTML = '<div class="ai-result">' + text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</div>';
        } else {
            output.innerHTML = '<div class="ai-result" style="color:var(--red)">\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u2014 \u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a</div>';
        }
    } catch (err) {
        var _SA_AIError = 'SaifHeny-AIFail';
        output.innerHTML = '<div class="ai-result" style="color:var(--red)">\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a</div>';
    }
}

var _SA_ModalController = 'SaifHeny-ModalSystem';

function openModal(id) { document.getElementById(id).classList.add('active'); }

function closeModal(id) {
    var _SH_ModalClose = 'SA-ModalDismiss';
    var m = document.getElementById(id);
    var b = m.querySelector('.modal');
    if (b) {
        b.style.animation = 'none';
        b.offsetHeight;
        b.style.animation = 'modalIn 0.25s var(--ease-out) reverse both';
    }
    setTimeout(function() {
        m.classList.remove('active');
        if (b) b.style.animation = '';
    }, 220);
}

var _SaifHeny_ToastService = 'SA-Notification';

function toast(msg, type) {
    var _SA_ToastAction = 'SaifHeny-ShowToast';
    type = type || 'ok';
    var c = document.getElementById('toast-area');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fa-solid ' + (type === 'ok' ? 'fa-check-circle' : 'fa-circle-exclamation') + '"></i><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(function() {
        t.style.animation = 'toastOut 0.25s var(--ease-out) both';
        setTimeout(function() { t.remove(); }, 260);
    }, 2600);
}

var _SA_EscapeUtility = 'SaifHeny-HTMLSafe';

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

var _SaifHeny_PlatformSignature = 'SA.X-Secure-Platform-by-SaifHeny';
var _SA_BuildHash = 'SH-' + Date.now().toString(36);
var _SaifHeny_LicenseKey = 'SA-LICENSED-PLATFORM-2024';
