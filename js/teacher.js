import { db, ref, set, push, get, remove, onValue, update } from './firebase-config.js';

var questions = [];
var deleteTargetId = null;
var currentExamId = null;
var currentExamData = null;
var editingId = null;
var currentReportLogs = null;
var currentReportStudentName = null;
var teacherId = null;

var GEMINI_KEY = 'AIzaSyBrvjg79Vxlc6wAgJwi1OZF37mtDB6TkOA';

document.addEventListener('DOMContentLoaded', function() {
    initTeacher();
    initNav();
    addQuestion();
    bindAll();
});

function initTeacher() {
    var id = localStorage.getItem('teacherId');
    if (!id) {
        id = 'T-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        localStorage.setItem('teacherId', id);
    }
    teacherId = id;

    var name = localStorage.getItem('teacherName');
    if (!name) {
        document.getElementById('modal-register').style.display = 'flex';
    } else {
        setTeacherUI(name);
    }

    document.getElementById('btn-register').addEventListener('click', function() {
        var val = document.getElementById('register-name-input').value.trim();
        if (!val) return;
        localStorage.setItem('teacherName', val);
        setTeacherUI(val);
        document.getElementById('modal-register').style.display = 'none';
        
        if (typeof hideAvatar === 'function') hideAvatar();
        
        toast('أهلاً ' + val + '! 👋', 'ok');
    });

    document.getElementById('register-name-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('btn-register').click();
    });

    document.getElementById('teacher-chip').addEventListener('click', function() {
        document.getElementById('register-name-input').value = localStorage.getItem('teacherName') || '';
        document.getElementById('modal-register').style.display = 'flex';
    });

    loadExams();
}

function setTeacherUI(name) {
    document.getElementById('teacher-name-label').textContent = name;
    var av = document.getElementById('teacher-chip-av');
    av.textContent = name.charAt(0).toUpperCase();
}

function initNav() {
    document.querySelectorAll('.nav-pill[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setNavActive(btn.dataset.view);
            go(btn.dataset.view);
        });
    });
}

function setNavActive(viewId) {
    document.querySelectorAll('.nav-pill[data-view]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.view === viewId);
    });
}

function go(viewId) {
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

function bindAll() {
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
}

function addQuestion() {
    questions.push({ text: '', options: ['', ''], correctAnswer: -1 });
    renderQ();
}

function removeQ(i) {
    if (questions.length <= 1) { toast('لازم سؤال واحد على الأقل', 'bad'); return; }
    if(confirm('متأكد إنك عايز تحذف السؤال (رقم '+(i+1)+') وكل خياراته؟')) {
        questions.splice(i, 1);
        renderQ();
    }
}

function addOpt(qi) {
    if (questions[qi].options.length >= 6) { toast('أقصى 6 خيارات', 'bad'); return; }
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
        var optsHtml = questions[qi].options.map(function(opt, oi) {
            var ok = q.correctAnswer === oi;
            return '<div class="opt' + (ok ? ' correct' : '') + '">'
                + '<input type="radio" class="opt-radio" name="ans-' + qi + '" ' + (ok ? 'checked' : '') + ' data-q="' + qi + '" data-o="' + oi + '">'
                + '<span style="font-weight:700;color:var(--text-3);font-size:0.72rem;min-width:14px">' + labels[oi] + '</span>'
                + '<input type="text" class="opt-text" placeholder="الخيار ' + labels[oi] + '" value="' + esc(opt) + '" data-q="' + qi + '" data-o="' + oi + '">'
                + '<button class="opt-x" data-q="' + qi + '" data-o="' + oi + '"><i class="fa-solid fa-xmark"></i></button>'
                + '</div>';
        }).join('');

        var block = document.createElement('div');
        block.className = 'q-block';
        block.style.animationDelay = (qi * 0.04) + 's';
        var isCollapsed = q._collapsed ? ' style="display:none;"' : '';
        var toggleIcon = q._collapsed ? 'fa-chevron-down' : 'fa-chevron-up';
        var qTitleStr = q.text ? q.text.substring(0, 40) + (q.text.length > 40 ? '...' : '') : 'سؤال جديد';

        block.innerHTML = '<div class="q-top" style="align-items:center;">'
            + '<div class="q-num" style="display:flex; align-items:center;"><span class="q-badge">' + (qi + 1) + '</span>السؤال ' + (qi + 1) 
            + (q._collapsed ? ' <span style="font-size:0.85rem; color: #888; font-weight:normal; margin-right:15px; background:rgba(0,0,0,0.2); padding:4px 10px; border-radius:99px;">' + esc(qTitleStr) + '</span>' : '') + '</div>'
            + '<div style="display:flex; gap:8px;">'
            + '<button class="icon-btn q-toggle" data-q="' + qi + '" title="تصغير/تكبير" style="border-radius:10px;"><i class="fa-solid '+toggleIcon+'"></i></button>'
            + '<button class="q-del" data-q="' + qi + '" title="حذف السؤال"><i class="fa-solid fa-eraser"></i></button>'
            + '</div>'
            + '</div>'
            + '<div class="q-body"'+isCollapsed+'>'
            + '<textarea class="q-input" data-q="' + qi + '" placeholder="اكتب نص السؤال هنا..." rows="1">' + esc(q.text) + '</textarea>'
            + '<div class="opts">' + optsHtml + '</div>'
            + '<button class="add-opt" data-q="' + qi + '"' + (q.options.length >= 6 ? ' style="display:none"' : '') + '>'
            + '<i class="fa-solid fa-plus"></i> إضافة خيار</button>'
            + '</div>';
        c.appendChild(block);
    });

    bindQEvents();
}

function bindQEvents() {
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

function startEdit(examId) {
    get(ref(db, 'exams/' + examId)).then(function(snap) {
        if (!snap.exists()) { toast('الامتحان مش موجود', 'bad'); return; }
        var data = snap.val();
        editingId = examId;

        document.getElementById('exam-title').value = data.title;
        document.getElementById('exam-duration').value = data.duration;
        document.getElementById('exam-max-attempts').value = data.maxAttempts !== undefined ? data.maxAttempts : 1;
        if (document.getElementById('show-correct-toggle')) {
            document.getElementById('show-correct-toggle').checked = data.showCorrectToStudent === true;
        }

        questions = data.questions.map(function(q) {
            return { text: q.text, options: q.options.slice(), correctAnswer: q.correctAnswer };
        });

        renderQ();
        document.getElementById('editing-banner').classList.remove('hidden');
        document.getElementById('builder-title').textContent = 'تعديل الامتحان';
        document.getElementById('builder-desc').textContent = 'عدل على الأسئلة ثم احفظ التعديلات';
        document.getElementById('btn-upload-exam').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات';

        goTo('builder');
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
    document.getElementById('exam-max-attempts').value = '1';
    questions = [];
    addQuestion();
}

async function uploadExam() {
    var title = document.getElementById('exam-title').value.trim();
    var dur = parseInt(document.getElementById('exam-duration').value);
    var maxAttempts = parseInt(document.getElementById('exam-max-attempts').value);
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
        maxAttempts: maxAttempts,
        showCorrectToStudent: document.getElementById('show-correct-toggle') ? document.getElementById('show-correct-toggle').checked : false,
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
    btn.innerHTML = '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0;flex-shrink:0;"></div> جاري الحفظ...';

    try {
        if (editingId) {
            var origSnap = await get(ref(db, 'exams/' + editingId + '/createdAt'));
            data.createdAt = origSnap.val() || Date.now();
            await set(ref(db, 'exams/' + editingId), data);
            toast('تم حفظ التعديلات ✓', 'ok');
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
            toast('تم الرفع ✓', 'ok');
            if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }

        btn.disabled = false;
        btn.innerHTML = editingId
            ? '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات'
            : '<i class="fa-solid fa-cloud-arrow-up"></i> رفع الامتحان';

    } catch (err) {
        console.error(err);
        toast('مشكلة في الحفظ — تأكد من الاتصال', 'bad');
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
    var text = inp.value;
    navigator.clipboard.writeText(text).then(function() {
        markCopied(btn);
    }).catch(function() {
        inp.select(); document.execCommand('copy'); markCopied(btn);
    });
}

function markCopied(btn) {
    btn.textContent = '✓ تم';
    btn.classList.add('done');
    setTimeout(function() { btn.textContent = 'نسخ'; btn.classList.remove('done'); }, 2200);
}

function copyExamLink(examId) {
    var base = window.location.origin + window.location.pathname.replace('index.html', '');
    var link = base + 'exam.html?id=' + examId;
    navigator.clipboard.writeText(link).then(function() { toast('تم نسخ الرابط ✓', 'ok'); })
        .catch(function() { toast('تم نسخ الرابط ✓', 'ok'); });
}

function loadExams() {
    onValue(ref(db, 'exams'), function(snap) {
        var container = document.getElementById('exams-list');
        var empty = document.getElementById('exams-empty');
        container.innerHTML = '';

        var allExams = snap.exists() ? snap.val() : {};
        var myExams = {};

        Object.keys(allExams).forEach(function(id) {
            if (allExams[id].teacherId === teacherId) myExams[id] = allExams[id];
        });

        if (Object.keys(myExams).length === 0) {
            container.appendChild(empty);
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';

        Object.keys(myExams).reverse().forEach(function(id, idx) {
            var e = myExams[id];
            var ds = new Date(e.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            var maxTxt = e.maxAttempts === 0 ? 'غير محدود' : e.maxAttempts + ' محاولة';

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
                + '<span><i class="fa-solid fa-list-ol"></i> ' + (e.questionCount || 0) + ' سؤال</span>'
                + '<span><i class="fa-regular fa-clock"></i> ' + e.duration + ' دقيقة</span>'
                + '<span><i class="fa-solid fa-rotate"></i> ' + maxTxt + '</span>'
                + '</div></div>'
                + '<div class="exam-card-actions">'
                + '<button class="icon-btn copy" title="نسخ الرابط" data-id="' + id + '"><i class="fa-solid fa-link"></i></button>'
                + '<button class="icon-btn edit" title="تعديل" data-id="' + id + '"><i class="fa-solid fa-pen-to-square"></i></button>'
                + '<button class="icon-btn del" title="حذف" data-id="' + id + '"><i class="fa-solid fa-eraser"></i></button>'
                + '<button class="icon-btn chart" title="النتائج" data-id="' + id + '"><i class="fa-solid fa-chart-column"></i></button>'
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

async function showResults(examId) {
    currentExamId = examId;
    goTo('results');

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId));

        if (!eSnap.exists()) { toast('امتحان مش موجود', 'bad'); return; }

        var exam = eSnap.val();
        currentExamData = exam;
        document.getElementById('results-title').textContent = exam.title;
        document.getElementById('results-desc').textContent = exam.questionCount + ' سؤال — ' + exam.duration + ' دقيقة';

        if (!aSnap.exists()) {
            setStats(0, 0, 0, 0);
            document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-3)">مفيش طلاب لسه</td></tr>';
            document.getElementById('leaderboard-wrap').style.display = 'none';
            return;
        }

        var rawAttempts = aSnap.val();
        var studentMap = {};

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

        ranked.forEach(function(r, idx) {
            var a = r.a;
            var fullName = (a.studentName || '—') + ' ' + (a.fatherName || '');
            var av = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.studentName) + '&background=random&color=fff';
            var stCls = a.status === 'cheated' ? 'cheat' : (a.status === 'submitted' ? 'ok' : 'prog');
            var stTxt = a.status === 'cheated' ? 'غش' : (a.status === 'submitted' ? 'تم' : 'جارٍ');
            var tStr = r.elapsed < Infinity ? fmtSecs(r.elapsed) : '—';

            var tr = document.createElement('tr');
            tr.innerHTML = '<td style="font-family:var(--font-en);font-weight:800;color:var(--text-3);font-size:0.78rem;">' + (idx + 1) + '</td>'
                + '<td><div class="stu-cell"><img src="' + av + '" class="stu-av" alt=""><div class="stu-name">' + esc(fullName) + '</div></div></td>'
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
        console.error(err);
        toast('مشكلة في التحميل', 'bad');
    }
}

function buildLeaderboard(top, exam) {
    var wrap = document.getElementById('leaderboard-wrap');
    var lb = document.getElementById('leaderboard');
    lb.innerHTML = '';

    if (!top || top.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    var rankClasses = ['gold', 'silver', 'bronze'];
    var medals = ['🥇', '🥈', '🥉'];

    top.forEach(function(r, idx) {
        var a = r.a;
        var fullName = (a.studentName || '—') + ' ' + (a.fatherName || '');
        var av = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.studentName) + '&background=random&color=fff';
        var rCls = idx < 3 ? rankClasses[idx] : 'default';
        var tStr = r.elapsed < Infinity ? fmtSecs(r.elapsed) : '—';

        var item = document.createElement('div');
        item.className = 'lb-item';
        item.style.animationDelay = (idx * 0.06) + 's';
        item.innerHTML = '<div class="lb-rank ' + rCls + '">' + (idx < 3 ? medals[idx] : (idx + 1)) + '</div>'
            + '<img src="' + av + '" class="lb-av" alt="">'
            + '<div class="lb-name">' + esc(fullName) + '</div>'
            + '<div class="lb-meta">'
            + '<span class="lb-score">' + r.pct + '%</span>'
            + '<span class="lb-time"><i class="fa-solid fa-clock"></i>' + tStr + '</span>'
            + '</div>';
        lb.appendChild(item);
    });
}

function setStats(total, avg, pass, cheat) {
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

async function showReport(examId, attemptId) {
    goTo('report');
    document.getElementById('ai-output').innerHTML = '';

    try {
        var eSnap = await get(ref(db, 'exams/' + examId));
        var aSnap = await get(ref(db, 'attempts/' + examId + '/' + attemptId));

        if (!eSnap.exists() || !aSnap.exists()) { toast('بيانات مش موجودة', 'bad'); return; }

        var exam = eSnap.val();
        var a = aSnap.val();

        currentReportLogs = a.logs || null;
        currentReportStudentName = (a.studentName || '') + ' ' + (a.fatherName || '');

        var fullName = (a.studentName || '—') + ' ' + (a.fatherName || '');
        var av = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.studentName) + '&background=random&color=fff';
        var st = a.startTime ? new Date(a.startTime).toLocaleTimeString('ar-EG') : '—';
        var et = a.endTime ? new Date(a.endTime).toLocaleTimeString('ar-EG') : '—';
        var elapsed = (a.endTime && a.startTime) ? fmtSecs(Math.floor((a.endTime - a.startTime) / 1000)) : '—';
        var stCls = a.status === 'cheated' ? 'cheat' : 'ok';
        var stTxt = a.status === 'cheated' ? 'محاولة غش' : 'تم التسليم';
        var pct = Math.round(((a.score || 0) / exam.questionCount) * 100);

        document.getElementById('rpt-header').innerHTML = '<div class="rpt-header-card">'
            + '<img src="' + av + '" class="rpt-av" alt="">'
            + '<div style="flex:1;min-width:0;">'
            + '<div class="rpt-name">' + esc(fullName) + '</div>'
            + '<div class="rpt-meta">'
            + '<span><i class="fa-solid fa-globe"></i><span class="font-en">' + (a.ip || '—') + '</span></span>'
            + '<span><i class="fa-solid fa-fingerprint"></i><span class="font-en">' + (a.fingerprint || '—').substring(0, 12) + '</span></span>'
            + '<span><span class="badge ' + stCls + '">' + stTxt + '</span></span>'
            + '</div>'
            + '<div class="rpt-meta" style="margin-top:4px;">'
            + '<span><i class="fa-regular fa-clock"></i>بداية: ' + st + '</span>'
            + '<span><i class="fa-solid fa-flag-checkered"></i>نهاية: ' + et + '</span>'
            + '<span><i class="fa-solid fa-stopwatch"></i>مدة: ' + elapsed + '</span>'
            + '<span><i class="fa-solid fa-star"></i>الدرجة: <strong style="color:' + (pct >= 50 ? 'var(--green)' : 'var(--red)') + '">' + (a.score || 0) + '/' + exam.questionCount + ' (' + pct + '%)</strong></span>'
            + '<span><i class="fa-solid fa-triangle-exclamation"></i>إنذارات: <strong>' + (a.strikes || 0) + '</strong></span>'
            + '</div></div></div>';

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
                    tag = '<span class="rpt-tag ctag">✓ صح + اختيار الطالب</span>';
                } else if (oi === q.correctAnswer) {
                    cls = 'is-correct'; ic = '<i class="fa-solid fa-check"></i>';
                    tag = '<span class="rpt-tag ctag">✓ الإجابة الصحيحة</span>';
                } else if (oi === sa) {
                    cls = 'is-wrong'; ic = '<i class="fa-solid fa-xmark"></i>';
                    tag = '<span class="rpt-tag wtag">✗ اختار الطالب</span>';
                }

                return '<div class="rpt-opt ' + cls + '">' + ic + ' ' + esc(opt) + tag + '</div>';
            }).join('');

            var card = document.createElement('div');
            card.className = 'rpt-q ' + (ok ? 'correct' : 'wrong');
            card.innerHTML = '<div class="rpt-q-head">'
                + '<span style="font-weight:800;font-size:0.85rem;">السؤال ' + (qi + 1) + '</span>'
                + '<span class="rpt-q-status ' + (ok ? 'correct' : 'wrong') + '"><i class="fa-solid ' + (ok ? 'fa-check' : 'fa-xmark') + '"></i> ' + (ok ? 'صح' : 'غلط') + '</span>'
                + '</div>'
                + '<div class="rpt-q-text">' + esc(q.text) + '</div>'
                + '<div class="rpt-opts">' + optsH + '</div>';
            qCont.appendChild(card);
        });

        var logList = document.getElementById('rpt-log-list');
        logList.innerHTML = '';

        if (a.logs) {
            Object.values(a.logs).sort(function(x, y) { return x.timestamp - y.timestamp; }).forEach(function(log) {
                var time = new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                var ic = 'fa-circle-info', cls = '', lbl = log.type;

                var map = {
                    'tab-switch': ['fa-eye-slash', 'warn', 'خروج من الصفحة'],
                    'tab-return': ['fa-eye', '', 'رجوع للصفحة'],
                    'blur': ['fa-window-minimize', 'warn', 'فقد تركيز النافذة'],
                    'fullscreen-exit': ['fa-compress', 'warn', 'خروج من ملء الشاشة'],
                    'strike': ['fa-triangle-exclamation', 'err', 'إنذار #' + (log.details || '')],
                    'auto-submit': ['fa-ban', 'err', 'تسليم تلقائي (غش)'],
                    'exam-start': ['fa-play', '', 'بداية الامتحان'],
                    'exam-submit': ['fa-flag-checkered', '', 'تسليم الامتحان']
                };

                if (map[log.type]) { ic = map[log.type][0]; cls = map[log.type][1]; lbl = map[log.type][2]; }

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
    output.innerHTML = '<div class="ai-loading"><div class="spin" style="width:20px;height:20px;border-width:2px;margin:0;flex-shrink:0;"></div> جاري التحليل...</div>';

    var logEntries = Object.values(currentReportLogs).sort(function(a, b) { return a.timestamp - b.timestamp; });
    var logText = logEntries.map(function(l) {
        return new Date(l.timestamp).toLocaleTimeString('ar-EG') + ' — ' + l.type + (l.details ? ' (' + l.details + ')' : '');
    }).join('\n');

    var prompt = 'أنت محلل سلوك طلاب في نظام امتحانات إلكتروني. حلل سجل النشاط التالي للطالب "'
        + currentReportStudentName + '" وقدم تقريرك بالعربية المصرية البسيطة.\n\n'
        + 'سجل النشاط:\n' + logText + '\n\n'
        + 'المطلوب:\n'
        + '1. ملخص سلوك الطالب\n'
        + '2. هل يوجد اشتباه في الغش؟ وليه؟\n'
        + '3. تحليل أوقات الخروج والدخول إن وجدت\n'
        + '4. توصيتك للمعلم بشكل مختصر وواضح\n\n'
        + 'اكتب بأسلوب واضح ومباشر بدون تنسيق markdown.';

    try {
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
            output.innerHTML = '<div class="ai-result" style="color:var(--red)">مشكلة في التحليل — حاول تاني</div>';
        }
    } catch (err) {
        console.error(err);
        output.innerHTML = '<div class="ai-result" style="color:var(--red)">خطأ في الاتصال بالذكاء الاصطناعي</div>';
    }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }

function closeModal(id) {
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

function toast(msg, type) {
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

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

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

function initTeacherAvatar() {
    var container = document.createElement('div');
    container.className = 'avatar-container';
    container.id = 'platform-avatar';
    container.innerHTML = createAvatarSVG() + '<div class="avatar-speech-bubble" id="avatar-bubble"></div>';
    document.body.appendChild(container);
    return container;
}

function avatarSay(msg) {
    var av = document.getElementById('platform-avatar');
    if (!av) av = initTeacherAvatar();
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

function hideAvatar() {
    var av = document.getElementById('platform-avatar');
    if (!av) return;
    av.classList.remove('show', 'speaking');
    var bubble = document.getElementById('avatar-bubble');
    if (bubble) bubble.classList.remove('show');
}

function runTeacherTour() {
    if(localStorage.getItem('tourTeachSkipped2')) return;

    var overlay = document.createElement('div');
    overlay.className = 'tour-spotlight-overlay';
    overlay.innerHTML = '<svg><defs><mask id="tour-mask"><rect width="100%" height="100%" fill="white"/><rect id="tour-hole" rx="14" ry="14" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)"/></svg>';

    var ring = document.createElement('div');
    ring.className = 'tour-spotlight-ring';

    var tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip-v2';

    document.body.append(overlay, ring, tooltip);

    var av = document.getElementById('platform-avatar');
    if (!av) av = initTeacherAvatar();
    av.classList.add('tour-mode');

    var steps = [];
    var isReg = document.getElementById('modal-register').style.display !== 'none';
    if(isReg) {
        steps = [
            { sel: '#register-name-input', txt: 'أهلاً بك يا أستاذي! اكتب اسمك هنا للبدء', avatar: 'مرحباً بك! أنا مساعدك' },
            { sel: '#btn-register', txt: 'وبعدين اضغط هنا لتدخل لوحة التحكم', avatar: 'خلينا ندخل!' }
        ];
    } else {
        steps = [
            { sel: '#exam-title', txt: 'اكتب عنوان الامتحان هنا', avatar: 'عنوان الامتحان مهم' },
            { sel: '#btn-add-question', txt: 'من هنا بتقدر تضيف أسئلة جديدة', avatar: 'أضف الأسئلة هنا' },
            { sel: '#btn-upload-exam', txt: 'خلصت؟ ارفع الامتحان من هنا!', avatar: 'ارفع وشارك الرابط' }
        ];
    }

    var current = 0;

    function positionElements() {
        if (current >= steps.length) {
            if (isReg) { endTour(); setTimeout(runTeacherTour, 1500); }
            else endTour();
            return;
        }
        var el = document.querySelector(steps[current].sel);
        if (!el) { current++; positionElements(); return; }

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
                + '<button class="tour-btn-next">' + (isLast ? '<i class="fa-solid fa-check"></i> تمام!' : 'التالي <i class="fa-solid fa-arrow-left"></i>') + '</button>'
                + '<button class="tour-btn-skip-inline">تخطي</button>'
                + '</div>';
            tooltip.classList.remove('show', 'pos-top', 'pos-bottom');

            var posClass = r.top > window.innerHeight / 2 ? 'pos-top' : 'pos-bottom';
            tooltip.classList.add(posClass);
            tooltip.style.left = Math.max(16, Math.min(window.innerWidth - 340, r.left + r.width / 2 - 160)) + 'px';

            setTimeout(function() {
                var ttH = tooltip.offsetHeight || 160;
                var ttTop = posClass === 'pos-top' ? (r.top - pad - ttH - 12) : (r.bottom + pad + 20);
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
        localStorage.setItem('tourTeachSkipped2', '1');
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
    if (document.getElementById('modal-register').style.display !== 'none') {
        initTeacherAvatar();
        var av = document.getElementById('platform-avatar');
        if (av) av.classList.add('show');
        avatarSay('أهلاً يا أستاذ! 👋');
        setTimeout(avatarStopSpeaking, 4000);
    }
}, 1500);
