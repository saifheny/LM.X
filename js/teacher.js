import { db, ref, set, push, get, remove, onValue, update } from './firebase-config.js';

var questions = [];
var deleteTargetId = null;
var currentExamId = null;
var currentExamData = null;
var editingId = null;
var currentReportLogs = null;
var currentReportStudentName = null;

var GEMINI_KEY = 'AIzaSyBrvjg79Vxlc6wAgJwi1OZF37mtDB6TkOA';

document.addEventListener('DOMContentLoaded', function() {
    checkTeacherName();
    initNav();
    addQuestion();
    loadExams();
    bindAll();
});

function checkTeacherName() {
    var name = localStorage.getItem('teacherName');
    if (!name) {
        openModal('modal-register');
    } else {
        document.getElementById('teacher-name-label').textContent = name;
    }

    document.getElementById('btn-register').addEventListener('click', function() {
        var val = document.getElementById('register-name-input').value.trim();
        if (!val) return;
        localStorage.setItem('teacherName', val);
        document.getElementById('teacher-name-label').textContent = val;
        closeModal('modal-register');
        toast('أهلاً ' + val + '! 👋', 'ok');
    });

    document.getElementById('register-name-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('btn-register').click();
    });

    document.getElementById('teacher-tag').addEventListener('click', function() {
        document.getElementById('register-name-input').value = localStorage.getItem('teacherName') || '';
        openModal('modal-register');
    });
}

function initNav() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            go(btn.dataset.view);
            document.querySelectorAll('.nav-btn[data-view]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
}

function go(viewId) {
    document.querySelectorAll('.view').forEach(function(s) { s.classList.remove('active'); });
    var el = document.getElementById('view-' + viewId);
    if (el) {
        el.classList.add('active');
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
    }
}

function goNav(viewId) {
    go(viewId);
    document.querySelectorAll('.nav-btn[data-view]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.view === viewId);
    });
}

function bindAll() {
    document.getElementById('btn-add-question').addEventListener('click', function() { addQuestion(); });
    document.getElementById('btn-upload-exam').addEventListener('click', uploadExam);
    document.getElementById('modal-upload-x').addEventListener('click', function() { closeModal('modal-upload'); });
    document.getElementById('btn-copy-link').addEventListener('click', copyLink);
    document.getElementById('modal-del-x').addEventListener('click', function() { closeModal('modal-del'); });
    document.getElementById('btn-cancel-del').addEventListener('click', function() { closeModal('modal-del'); });
    document.getElementById('btn-confirm-del').addEventListener('click', doDel);
    document.getElementById('btn-back-results').addEventListener('click', function() { goNav('exams'); });
    document.getElementById('btn-back-report').addEventListener('click', function() {
        if (currentExamId) viewResults(currentExamId);
    });
    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('btn-ai-analyze').addEventListener('click', runAIAnalysis);

    ['modal-upload', 'modal-del'].forEach(function(id) {
        document.getElementById(id).addEventListener('click', function(e) {
            if (e.target === e.currentTarget) closeModal(id);
        });
    });
}

function addQuestion() {
    questions.push({ text: '', options: ['', ''], correctAnswer: -1 });
    renderQ();
}

function removeQ(i) {
    if (questions.length <= 1) { toast('لازم سؤال واحد على الأقل', 'bad'); return; }
    questions.splice(i, 1);
    renderQ();
}

function addOpt(qi) {
    if (questions[qi].options.length >= 6) { toast('أقصى عدد 6 خيارات', 'bad'); return; }
    questions[qi].options.push('');
    renderQ();
}

function removeOpt(qi, oi) {
    if (questions[qi].options.length <= 2) { toast('لازم خيارين على الأقل', 'bad'); return; }
    if (questions[qi].correctAnswer === oi) questions[qi].correctAnswer = -1;
    else if (questions[qi].correctAnswer > oi) questions[qi].correctAnswer--;
    questions[qi].options.splice(oi, 1);
    renderQ();
}

function renderQ() {
    var c = document.getElementById('questions-container');
    c.innerHTML = '';
    var labels = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

    questions.forEach(function(q, qi) {
        var optsHtml = '';
        q.options.forEach(function(opt, oi) {
            var ok = q.correctAnswer === oi;
            optsHtml += '<div class="opt ' + (ok ? 'correct' : '') + '">'
                + '<input type="radio" class="opt-radio" name="ans-' + qi + '" ' + (ok ? 'checked' : '') + ' data-q="' + qi + '" data-o="' + oi + '">'
                + '<span style="font-weight:600;color:var(--text-3);font-size:0.75rem;min-width:14px;">' + labels[oi] + '</span>'
                + '<input type="text" placeholder="الخيار ' + labels[oi] + '" value="' + esc(opt) + '" data-q="' + qi + '" data-o="' + oi + '" class="opt-text">'
                + '<button class="opt-x" data-q="' + qi + '" data-o="' + oi + '"><i class="fa-solid fa-xmark"></i></button>'
                + '</div>';
        });

        var block = document.createElement('div');
        block.className = 'q-block';
        block.style.animationDelay = (qi * 0.04) + 's';
        block.innerHTML = '<div class="q-top">'
            + '<div class="q-num"><span class="q-badge">' + (qi + 1) + '</span> السؤال ' + (qi + 1) + '</div>'
            + '<button class="q-del" data-q="' + qi + '"><i class="fa-solid fa-trash-can"></i></button>'
            + '</div>'
            + '<textarea class="q-input" placeholder="اكتب نص السؤال هنا..." data-q="' + qi + '" rows="1">' + q.text + '</textarea>'
            + '<div class="opts">' + optsHtml + '</div>'
            + '<button class="add-opt" data-q="' + qi + '" ' + (q.options.length >= 6 ? 'style="display:none"' : '') + '>'
            + '<i class="fa-solid fa-plus"></i> إضافة خيار</button>';
        c.appendChild(block);
    });

    bindQ();
}

function bindQ() {
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
            var b = e.currentTarget;
            removeOpt(+b.dataset.q, +b.dataset.o);
        });
    });

    document.querySelectorAll('.q-del').forEach(function(el) {
        el.addEventListener('click', function(e) {
            removeQ(+e.currentTarget.dataset.q);
        });
    });

    document.querySelectorAll('.add-opt').forEach(function(el) {
        el.addEventListener('click', function(e) {
            addOpt(+e.currentTarget.dataset.q);
        });
    });
}

function startEdit(examId) {
    get(ref(db, 'exams/' + examId)).then(function(snap) {
        if (!snap.exists()) { toast('الامتحان مش موجود', 'bad'); return; }
        var data = snap.val();
        editingId = examId;

        document.getElementById('exam-title').value = data.title;
        document.getElementById('exam-duration').value = data.duration;

        questions = data.questions.map(function(q) {
            return { text: q.text, options: q.options.slice(), correctAnswer: q.correctAnswer };
        });

        renderQ();

        document.getElementById('editing-banner').classList.remove('hidden');
        document.getElementById('builder-title').textContent = 'تعديل الامتحان';
        document.getElementById('builder-desc').textContent = 'عدل على الأسئلة واحفظ التعديلات';

        var uploadBtn = document.getElementById('btn-upload-exam');
        uploadBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات';

        goNav('builder');
        toast('تم تحميل الامتحان للتعديل', 'ok');
    });
}

function cancelEdit() {
    editingId = null;
    document.getElementById('editing-banner').classList.add('hidden');
    document.getElementById('builder-title').textContent = 'إنشاء امتحان جديد';
    document.getElementById('builder-desc').textContent = 'أضف الأسئلة والخيارات وارفع الامتحان مباشرة';
    document.getElementById('btn-upload-exam').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> رفع الامتحان';
    document.getElementById('exam-title').value = '';
    document.getElementById('exam-duration').value = '';
    questions = [];
    addQuestion();
}

async function uploadExam() {
    var title = document.getElementById('exam-title').value.trim();
    var dur = parseInt(document.getElementById('exam-duration').value);
    var teacher = localStorage.getItem('teacherName') || 'معلم';

    if (!title) { toast('اكتب عنوان الامتحان', 'bad'); return; }
    if (!dur || dur < 1) { toast('حدد مدة صحيحة', 'bad'); return; }

    syncDOM();

    for (var i = 0; i < questions.length; i++) {
        if (!questions[i].text.trim()) { toast('السؤال ' + (i + 1) + ' فاضي', 'bad'); return; }
        for (var j = 0; j < questions[i].options.length; j++) {
            if (!questions[i].options[j].trim()) { toast('خيار فاضي في سؤال ' + (i + 1), 'bad'); return; }
        }
        if (questions[i].correctAnswer === -1) { toast('حدد الإجابة الصحيحة للسؤال ' + (i + 1), 'bad'); return; }
    }

    var data = {
        title: title,
        duration: dur,
        createdAt: Date.now(),
        questionCount: questions.length,
        teacher: teacher,
        questions: questions.map(function(q) {
            return { text: q.text, options: q.options, correctAnswer: q.correctAnswer };
        })
    };

    var btn = document.getElementById('btn-upload-exam');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;"></div> جاري الحفظ...';

    try {
        if (editingId) {
            data.createdAt = (await get(ref(db, 'exams/' + editingId + '/createdAt'))).val() || Date.now();
            await set(ref(db, 'exams/' + editingId), data);
            toast('تم حفظ التعديلات ✓', 'ok');
            cancelEdit();
        } else {
            var id = genId();
            await set(ref(db, 'exams/' + id), data);

            var base = window.location.href.replace('index.html', '').replace(/\/$/, '');
            var link = base + '/exam.html?id=' + id;
            document.getElementById('exam-link-input').value = link;
            document.getElementById('exam-id-show').textContent = id;
            openModal('modal-upload');

            document.getElementById('exam-title').value = '';
            document.getElementById('exam-duration').value = '';
            questions = [];
            addQuestion();
            toast('تم الرفع ✓', 'ok');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> رفع الامتحان';
        loadExams();
    } catch (err) {
        console.error(err);
        toast('مشكلة في الحفظ', 'bad');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> رفع الامتحان';
    }
}

function syncDOM() {
    document.querySelectorAll('.q-input').forEach(function(el) {
        questions[+el.dataset.q].text = el.value;
    });
    document.querySelectorAll('.opt-text').forEach(function(el) {
        var q = +el.dataset.q, o = +el.dataset.o;
        if (questions[q] && questions[q].options[o] !== undefined) questions[q].options[o] = el.value;
    });
}

function genId() {
    var ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 6; i++) r += ch[Math.floor(Math.random() * ch.length)];
    return r;
}

function copyLink() {
    var inp = document.getElementById('exam-link-input');
    var btn = document.getElementById('btn-copy-link');
    navigator.clipboard.writeText(inp.value).then(function() {
        btn.textContent = '✓ تم';
        btn.classList.add('done');
        setTimeout(function() { btn.textContent = 'نسخ'; btn.classList.remove('done'); }, 2000);
    }).catch(function() {
        inp.select();
        document.execCommand('copy');
        btn.textContent = '✓ تم';
        btn.classList.add('done');
        setTimeout(function() { btn.textContent = 'نسخ'; btn.classList.remove('done'); }, 2000);
    });
}

function copyExamLink(examId) {
    var base = window.location.href.replace('index.html', '').replace(/\/$/, '');
    var link = base + '/exam.html?id=' + examId;
    navigator.clipboard.writeText(link).then(function() {
        toast('تم نسخ الرابط ✓', 'ok');
    }).catch(function() {
        toast('تم نسخ الرابط ✓', 'ok');
    });
}

function loadExams() {
    onValue(ref(db, 'exams'), function(snap) {
        var list = document.getElementById('exams-list');
        var empty = document.getElementById('exams-empty');
        list.innerHTML = '';

        if (!snap.exists() || Object.keys(snap.val()).length === 0) {
            list.appendChild(empty);
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';
        var exams = snap.val();

        Object.keys(exams).reverse().forEach(function(id, idx) {
            var e = exams[id];
            var d = new Date(e.createdAt);
            var ds = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

            var row = document.createElement('div');
            row.className = 'exam-row';
            row.style.animationDelay = (idx * 0.05) + 's';
            row.innerHTML = '<div class="exam-row-info">'
                + '<div class="exam-row-icon"><i class="fa-solid fa-file-lines"></i></div>'
                + '<div class="exam-row-text">'
                + '<h3>' + esc(e.title) + '</h3>'
                + '<div class="exam-row-meta">'
                + '<span><i class="fa-regular fa-calendar"></i> ' + ds + '</span>'
                + '<span><i class="fa-solid fa-list-ol"></i> ' + (e.questionCount || 0) + ' سؤال</span>'
                + '<span><i class="fa-regular fa-clock"></i> ' + e.duration + ' دقيقة</span>'
                + '<span class="font-en" style="font-size:0.68rem;color:var(--text-3);">' + id + '</span>'
                + '</div></div></div>'
                + '<div class="exam-row-actions">'
                + '<button class="icon-btn copy" title="نسخ الرابط" data-id="' + id + '"><i class="fa-solid fa-link"></i></button>'
                + '<button class="icon-btn edit" title="تعديل" data-id="' + id + '"><i class="fa-solid fa-pen-to-square"></i></button>'
                + '<button class="icon-btn del" title="حذف" data-id="' + id + '"><i class="fa-solid fa-trash-can"></i></button>'
                + '<button class="icon-btn chart" title="النتائج" data-id="' + id + '"><i class="fa-solid fa-chart-column"></i></button>'
                + '<button class="icon-btn report" title="تقارير" data-id="' + id + '"><i class="fa-solid fa-magnifying-glass-chart"></i></button>'
                + '</div>';
            list.appendChild(row);
        });

        list.querySelectorAll('.icon-btn.copy').forEach(function(b) {
            b.addEventListener('click', function() { copyExamLink(b.dataset.id); });
        });
        list.querySelectorAll('.icon-btn.edit').forEach(function(b) {
            b.addEventListener('click', function() { startEdit(b.dataset.id); });
        });
        list.querySelectorAll('.icon-btn.del').forEach(function(b) {
            b.addEventListener('click', function() { deleteTargetId = b.dataset.id; openModal('modal-del'); });
        });
        list.querySelectorAll('.icon-btn.chart').forEach(function(b) {
            b.addEventListener('click', function() { viewResults(b.dataset.id); });
        });
        list.querySelectorAll('.icon-btn.report').forEach(function(b) {
            b.addEventListener('click', function() { viewResults(b.dataset.id); });
        });

        list.appendChild(empty);
    });
}

async function doDel() {
    if (!deleteTargetId) return;
    try {
        await remove(ref(db, 'exams/' + deleteTargetId));
        await remove(ref(db, 'attempts/' + deleteTargetId));
        closeModal('modal-del');
        toast('تم الحذف', 'ok');
        deleteTargetId = null;
    } catch (err) {
        console.error(err);
        toast('مشكلة في الحذف', 'bad');
    }
}

async function viewResults(examId) {
    currentExamId = examId;
    go('results');
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId));

        if (!eSnap.exists()) { toast('امتحان مش موجود', 'bad'); return; }

        var exam = eSnap.val();
        currentExamData = exam;
        document.getElementById('results-title').textContent = 'نتائج: ' + exam.title;
        document.getElementById('results-desc').textContent = exam.questionCount + ' سؤال — ' + exam.duration + ' دقيقة';

        if (!aSnap.exists()) {
            ['s-total', 's-avg', 's-pass', 's-cheat'].forEach(function(id) {
                document.getElementById(id).textContent = '0';
            });
            document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-3);">مفيش طلاب لسه</td></tr>';
            return;
        }

        var attempts = aSnap.val();
        var ids = Object.keys(attempts);
        var totalPct = 0, passed = 0, cheated = 0;
        var tbody = document.getElementById('stu-tbody');
        tbody.innerHTML = '';

        ids.forEach(function(aid) {
            var a = attempts[aid];
            var sc = a.score || 0;
            var tot = a.totalQuestions || exam.questionCount || 1;
            var pct = Math.round((sc / tot) * 100);
            totalPct += pct;
            if (pct >= 50) passed++;
            if (a.status === 'cheated') cheated++;

            var fullName = (a.studentName || '—') + ' ' + (a.fatherName || '');
            var t = a.startTime ? new Date(a.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
            var av = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(a.studentName || 'x');
            var stCls = a.status === 'cheated' ? 'cheat' : (a.status === 'submitted' ? 'ok' : 'prog');
            var stTxt = a.status === 'cheated' ? 'غش' : (a.status === 'submitted' ? 'تم' : 'جاري');

            var tr = document.createElement('tr');
            tr.innerHTML = '<td><div class="student-cell">'
                + '<img src="' + av + '" class="stu-avatar" alt="">'
                + '<div><strong>' + esc(fullName) + '</strong></div></div></td>'
                + '<td><span class="score-val" style="color:' + (pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + pct + '%</span>'
                + ' <span style="font-size:0.7rem;color:var(--text-3);">(' + sc + '/' + tot + ')</span></td>'
                + '<td><span class="badge ' + stCls + '"><i class="fa-solid ' + (a.status === 'cheated' ? 'fa-ban' : 'fa-check-circle') + '"></i> ' + stTxt + '</span></td>'
                + '<td style="font-family:var(--font-en);font-size:0.78rem;color:var(--text-2);">' + (a.ip || '—') + '</td>'
                + '<td style="font-size:0.82rem;">' + t + '</td>'
                + '<td><button class="btn btn-sm btn-soft view-rpt" data-a="' + aid + '" data-e="' + examId + '"><i class="fa-solid fa-eye"></i></button></td>';
            tbody.appendChild(tr);
        });

        document.getElementById('s-total').textContent = ids.length;
        document.getElementById('s-avg').textContent = (ids.length ? Math.round(totalPct / ids.length) : 0) + '%';
        document.getElementById('s-pass').textContent = passed;
        document.getElementById('s-cheat').textContent = cheated;

        tbody.querySelectorAll('.view-rpt').forEach(function(b) {
            b.addEventListener('click', function() { viewReport(b.dataset.e, b.dataset.a); });
        });
    } catch (err) {
        console.error(err);
        toast('مشكلة في التحميل', 'bad');
    }
}

async function viewReport(examId, attemptId) {
    go('report');
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById('ai-output').innerHTML = '';

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId + '/' + attemptId));

        if (!eSnap.exists() || !aSnap.exists()) { toast('بيانات مش موجودة', 'bad'); return; }

        var exam = eSnap.val();
        var a = aSnap.val();

        currentReportLogs = a.logs || null;
        currentReportStudentName = (a.studentName || '') + ' ' + (a.fatherName || '');

        var av = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(a.studentName || 'x');
        var stCls = a.status === 'cheated' ? 'cheat' : 'ok';
        var stTxt = a.status === 'cheated' ? 'محاولة غش' : 'تم التسليم';
        var st = a.startTime ? new Date(a.startTime).toLocaleTimeString('ar-EG') : '—';
        var et = a.endTime ? new Date(a.endTime).toLocaleTimeString('ar-EG') : '—';
        var fullName = (a.studentName || '—') + ' ' + (a.fatherName || '');

        document.getElementById('rpt-header').innerHTML = '<div class="rpt-header">'
            + '<img src="' + av + '" class="rpt-avatar" alt="">'
            + '<div>'
            + '<div class="rpt-name">' + esc(fullName) + '</div>'
            + '<div class="rpt-meta">'
            + '<span><i class="fa-solid fa-globe"></i> <span class="font-en">' + (a.ip || '—') + '</span></span>'
            + '<span><i class="fa-solid fa-fingerprint"></i> <span class="font-en">' + (a.fingerprint || '—').substring(0, 12) + '</span></span>'
            + '<span><span class="badge ' + stCls + '">' + stTxt + '</span></span>'
            + '</div>'
            + '<div class="rpt-meta" style="margin-top:4px;">'
            + '<span><i class="fa-regular fa-clock"></i> بداية: ' + st + '</span>'
            + '<span><i class="fa-solid fa-flag-checkered"></i> نهاية: ' + et + '</span>'
            + '<span><i class="fa-solid fa-star"></i> الدرجة: <strong style="color:' + (((a.score || 0) / exam.questionCount * 100) >= 50 ? 'var(--green)' : 'var(--red)') + '">' + (a.score || 0) + '/' + exam.questionCount + '</strong></span>'
            + '<span><i class="fa-solid fa-triangle-exclamation"></i> إنذارات: <strong>' + (a.strikes || 0) + '</strong></span>'
            + '</div></div></div>';

        var qEl = document.getElementById('rpt-questions');
        qEl.innerHTML = '';
        var ans = a.answers || {};

        exam.questions.forEach(function(q, qi) {
            var sa = ans[qi] !== undefined ? parseInt(ans[qi]) : -1;
            var ok = sa === q.correctAnswer;

            var optsH = '';
            q.options.forEach(function(opt, oi) {
                var cls = '';
                var ic = '<i class="fa-regular fa-circle" style="opacity:0.3;"></i>';
                var tag = '';

                if (oi === q.correctAnswer && oi === sa) {
                    cls = 'is-correct';
                    ic = '<i class="fa-solid fa-check"></i>';
                    tag = '<span class="rpt-tag correct-tag">✓ الإجابة الصحيحة — اختيار الطالب</span>';
                } else if (oi === q.correctAnswer) {
                    cls = 'is-correct';
                    ic = '<i class="fa-solid fa-check"></i>';
                    tag = '<span class="rpt-tag correct-tag">✓ الإجابة الصحيحة</span>';
                } else if (oi === sa) {
                    cls = 'is-wrong';
                    ic = '<i class="fa-solid fa-xmark"></i>';
                    tag = '<span class="rpt-tag wrong-tag">✗ اختيار الطالب</span>';
                }

                optsH += '<div class="rpt-opt ' + cls + '">' + ic + ' ' + esc(opt) + tag + '</div>';
            });

            var card = document.createElement('div');
            card.className = 'rpt-q ' + (ok ? 'correct' : 'wrong');
            card.innerHTML = '<div class="rpt-q-head">'
                + '<span style="font-weight:700;">السؤال ' + (qi + 1) + '</span>'
                + '<span class="rpt-status ' + (ok ? 'correct' : 'wrong') + '">'
                + '<i class="fa-solid ' + (ok ? 'fa-check' : 'fa-xmark') + '"></i> '
                + (ok ? 'صح' : 'غلط') + '</span></div>'
                + '<div class="rpt-q-text">' + esc(q.text) + '</div>'
                + '<div class="rpt-opts">' + optsH + '</div>';
            qEl.appendChild(card);
        });

        var logList = document.getElementById('rpt-log-list');
        logList.innerHTML = '';

        if (a.logs) {
            var logEntries = Object.values(a.logs).sort(function(x, y) { return x.timestamp - y.timestamp; });
            logEntries.forEach(function(log) {
                var time = new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                var ic = 'fa-circle-info';
                var cls = '';
                var lbl = log.type;

                if (log.type === 'tab-switch') { ic = 'fa-eye-slash'; cls = 'warn'; lbl = 'خروج من الصفحة'; }
                else if (log.type === 'tab-return') { ic = 'fa-eye'; lbl = 'رجوع للصفحة'; }
                else if (log.type === 'blur') { ic = 'fa-window-minimize'; cls = 'warn'; lbl = 'فقد تركيز النافذة'; }
                else if (log.type === 'fullscreen-exit') { ic = 'fa-compress'; cls = 'warn'; lbl = 'خروج من ملء الشاشة'; }
                else if (log.type === 'strike') { ic = 'fa-triangle-exclamation'; cls = 'err'; lbl = 'إنذار #' + (log.details || ''); }
                else if (log.type === 'auto-submit') { ic = 'fa-ban'; cls = 'err'; lbl = 'تسليم تلقائي (غش)'; }
                else if (log.type === 'exam-start') { ic = 'fa-play'; lbl = 'بداية الامتحان'; }
                else if (log.type === 'exam-submit') { ic = 'fa-flag-checkered'; lbl = 'تسليم الامتحان'; }

                var el = document.createElement('div');
                el.className = 'log-item ' + cls;
                el.innerHTML = '<i class="fa-solid ' + ic + '"></i><span>' + lbl + '</span><span class="log-t">' + time + '</span>';
                logList.appendChild(el);
            });
        } else {
            logList.innerHTML = '<div class="log-item"><i class="fa-solid fa-circle-info"></i> مفيش سجل نشاط</div>';
        }

    } catch (err) {
        console.error(err);
        toast('مشكلة في التقرير', 'bad');
    }
}

async function runAIAnalysis() {
    if (!currentReportLogs) {
        toast('مفيش بيانات نشاط لتحليلها', 'bad');
        return;
    }

    var output = document.getElementById('ai-output');
    output.innerHTML = '<div class="ai-loading"><div class="spin" style="width:20px;height:20px;border-width:2px;margin:0;"></div> جاري التحليل بالذكاء الاصطناعي...</div>';

    var logEntries = Object.values(currentReportLogs).sort(function(a, b) { return a.timestamp - b.timestamp; });
    var logText = logEntries.map(function(l) {
        return new Date(l.timestamp).toLocaleTimeString('ar-EG') + ' — ' + l.type + (l.details ? ' (' + l.details + ')' : '');
    }).join('\n');

    var prompt = 'أنت محلل سلوك طلاب في نظام امتحانات إلكتروني آمن. '
        + 'حلل سجل النشاط التالي للطالب "' + currentReportStudentName + '" وقدم تقريرك بالعربية المصرية.\n\n'
        + 'سجل النشاط:\n' + logText + '\n\n'
        + 'اكتب تقرير مفصل يشمل:\n'
        + '1. ملخص سلوك الطالب أثناء الامتحان\n'
        + '2. هل يوجد اشتباه في الغش؟ وليه؟\n'
        + '3. تحليل أوقات الخروج والدخول\n'
        + '4. توصيتك للمعلم\n\n'
        + 'اكتب بأسلوب واضح ومباشر.';

    try {
        var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        var data = await res.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            var text = data.candidates[0].content.parts[0].text;
            output.innerHTML = '<div class="ai-result">' + formatAIText(text) + '</div>';
        } else {
            output.innerHTML = '<div class="ai-result" style="color:var(--red);">مشكلة في التحليل — حاول تاني</div>';
        }
    } catch (err) {
        console.error(err);
        output.innerHTML = '<div class="ai-result" style="color:var(--red);">خطأ في الاتصال بالذكاء الاصطناعي</div>';
    }
}

function formatAIText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }

function closeModal(id) {
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

function toast(msg, type) {
    type = type || 'ok';
    var c = document.getElementById('toast-area');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<i class="fa-solid ' + (type === 'ok' ? 'fa-check-circle' : 'fa-circle-exclamation') + '"></i><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(function() {
        t.style.animation = 'toastOut 0.25s var(--ease) both';
        setTimeout(function() { t.remove(); }, 250);
    }, 2500);
}

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
