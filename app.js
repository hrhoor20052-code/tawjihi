const API_URL = "http://127.0.0.1:3001/api";

let currentTemplate = [];

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Tab Switching
    const tabBtns = document.querySelectorAll(".tab-btn");
    const sections = {
        "student-section": document.getElementById("student-section"),
        "template-section": document.getElementById("template-section"),
        "table-section": document.getElementById("table-section")
    };

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            Object.values(sections).forEach(sec => sec.style.display = "none");
            sections[btn.dataset.target].style.display = "block";
            
            if(btn.dataset.target === "table-section") fetchStudents();
        });
    });

    // 2. Templates Management
    await loadTemplate();

    document.getElementById("btn-add-template-subject").addEventListener("click", () => {
        addSubjectToUI(document.getElementById("template-subjects-container"), true);
    });

    document.getElementById("template-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        saveTemplate();
    });

    // 3. Student Form Management
    document.getElementById("btn-add-extra-subject").addEventListener("click", () => {
        addSubjectToUI(document.getElementById("student-subjects-container"), false);
    });

    document.getElementById("student-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        submitStudent();
    });

    fetchStudents();
});

// --- TEMPLATE LOGIC ---
async function loadTemplate() {
    try {
        const res = await fetch(`${API_URL}/settings/template`);
        const data = await res.json();
        currentTemplate = data.template || [];
        
        const tmplContainer = document.getElementById("template-subjects-container");
        tmplContainer.innerHTML = "";
        
        const stContainer = document.getElementById("student-subjects-container");
        stContainer.innerHTML = "";

        if(currentTemplate.length === 0) {
            addSubjectToUI(tmplContainer, true);
        } else {
            currentTemplate.forEach(sub => {
                addSubjectToUI(tmplContainer, true, sub);
                addSubjectToUI(stContainer, false, sub);
            });
        }
    } catch(e) {
        console.error("Error loading template", e);
    }
}

async function saveTemplate() {
    const container = document.getElementById("template-subjects-container");
    const blocks = container.querySelectorAll(".subject-block");
    const newTemplate = [];

    blocks.forEach(block => {
        newTemplate.push({
            name: block.querySelector(".inp-name").value.trim(),
            maxScore: parseFloat(block.querySelector(".inp-max").value),
            weight: parseFloat(block.querySelector(".inp-weight").value),
            papersCount: parseInt(block.querySelector(".inp-papers").value)
        });
    });

    const statusEl = document.getElementById("template-status-message");
    
    try {
        const res = await fetch(`${API_URL}/settings/template`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({template: newTemplate})
        });
        if(res.ok) {
            showStatus(statusEl, "تم حفظ القالب بنجاح! سيتم تطبيقه على كل طالب جديد", "success");
            currentTemplate = newTemplate;
            // Reload student form template
            const stContainer = document.getElementById("student-subjects-container");
            stContainer.innerHTML = "";
            currentTemplate.forEach(sub => addSubjectToUI(stContainer, false, sub));
        } else {
            throw new Error();
        }
    } catch(e) {
        showStatus(statusEl, "حدث خطأ أثناء الحفظ", "error");
    }
}

// --- SHARED UI LOGIC ---
function addSubjectToUI(container, isTemplate, data = null) {
    const block = document.createElement("div");
    block.className = "subject-block";

    const defaultName = data ? data.name : "";
    const defaultMax = data ? data.maxScore : 100;
    const defaultWeight = data ? data.weight : 20;
    const defaultPapers = data ? data.papersCount : 1;

    let html = `
        <button type="button" class="subject-block-remove">×</button>
        <div class="row">
            <div class="input-group">
                <label>اسم المادة</label>
                <input type="text" class="inp-name" value="${defaultName}" required ${isTemplate ? "" : "readonly"}>
            </div>
            <div class="input-group">
                <label>العلامة العظمى</label>
                <select class="inp-max" ${isTemplate ? "" : "readonly disabled"}>
                    <option value="50" ${defaultMax==50?'selected':''}>50</option>
                    <option value="75" ${defaultMax==75?'selected':''}>75</option>
                    <option value="100" ${defaultMax==100?'selected':''}>100</option>
                    <option value="200" ${defaultMax==200?'selected':''}>200</option>
                    <option value="500" ${defaultMax==500?'selected':''}>500</option>
                </select>
            </div>
        </div>
        <div class="row">
            <div class="input-group">
                <label>النسبة من المعدل العام (%)</label>
                <input type="number" class="inp-weight" value="${defaultWeight}" required ${isTemplate ? "" : "readonly"}>
            </div>
            <div class="input-group">
                <label>عدد الأوراق</label>
                <select class="inp-papers" ${isTemplate ? "" : "readonly disabled"}>
                    <option value="1" ${defaultPapers==1?'selected':''}>ورقة واحدة</option>
                    <option value="2" ${defaultPapers==2?'selected':''}>ورقتان (يؤخذ المتوسط)</option>
                </select>
            </div>
        </div>
    `;

    // If it's the student form, we show grade inputs!
    if(!isTemplate) {
        let gradesHtml = `<div class="divider">إدخال علامات: ${defaultName}</div><div class="row">`;
        gradesHtml += `
            <div class="input-group">
                <label>نتيجة الورقة الأولى</label>
                <input type="number" step="0.5" class="val-p1" required>
            </div>
        `;
        if(defaultPapers == 2) {
            gradesHtml += `
            <div class="input-group">
                <label>نتيجة الورقة الثانية</label>
                <input type="number" step="0.5" class="val-p2" required>
            </div>
            `;
        }
        gradesHtml += `</div>`;
        html += gradesHtml;

        // If extra subject is added dynamically to student, make it editable
        if(!data) {
            html = html.replace(/readonly/g, "").replace(/disabled/g, "");
            html = html.replace('إدخال علامات: ', 'إدخال علامات المادة الإضافية');
        }
    }

    block.innerHTML = html;
    
    block.querySelector(".subject-block-remove").addEventListener("click", () => {
        block.remove();
    });

    container.appendChild(block);
}

// --- STUDENT LOGIC ---
async function submitStudent() {
    const seatNumber = document.getElementById("seatNumber").value.trim();
    const name = document.getElementById("name").value.trim();
    const blocks = document.getElementById("student-subjects-container").querySelectorAll(".subject-block");
    const statusEl = document.getElementById("student-status-message");

    const details = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let isFailingAny = false;

    for(let block of blocks) {
        const subjName = block.querySelector(".inp-name").value.trim();
        const maxScore = parseFloat(block.querySelector(".inp-max").value);
        const weight = parseFloat(block.querySelector(".inp-weight").value);
        const papersCount = parseInt(block.querySelector(".inp-papers").value);
        
        const p1 = parseFloat(block.querySelector(".val-p1").value);
        let subjectAverage = p1;

        let p2 = null;
        if(papersCount === 2) {
            p2 = parseFloat(block.querySelector(".val-p2").value);
            subjectAverage = (p1 + p2) / 2;
        }

        // Pass/Fail check
        const passed = subjectAverage >= (maxScore * 0.5);
        if(!passed) isFailingAny = true;

        totalWeight += weight;
        // Percentage of this subject (e.g. 90/100 -> 90%)
        const subjPercentage = (subjectAverage / maxScore) * 100;
        totalWeightedScore += (subjPercentage * weight);

        details.push({
            name: subjName,
            maxScore,
            weight,
            papersCount,
            paper1: p1,
            paper2: p2,
            average: subjectAverage,
            passed: passed
        });
    }

    let finalGrade = 0;
    if(totalWeight > 0) {
        finalGrade = totalWeightedScore / totalWeight; // Max 100
    }
    
    // Status is Fail if ANY subject is failed
    const status = isFailingAny ? "راسب" : "ناجح";

    const payload = {
        seatNumber,
        name,
        finalGrade: parseFloat(finalGrade.toFixed(2)),
        status,
        details
    };

    try {
        const res = await fetch(`${API_URL}/students`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            showStatus(statusEl, `تم الحفظ بنجاح! المعدل النهائي: ${payload.finalGrade}% - الحالة: ${payload.status}`, "success");
            const inputs = document.getElementById("student-form").querySelectorAll(".val-p1, .val-p2, #seatNumber, #name");
            inputs.forEach(i => i.value = "");
        } else {
            throw new Error();
        }
    } catch(e) {
        showStatus(statusEl, "تعذر الحفظ. تأكد من الاتصال بالخادم", "error");
    }
}

async function fetchStudents() {
    try {
        const response = await fetch(`${API_URL}/students`);
        if(response.ok) {
            const data = await response.json();
            renderTable(data);
        }
    } catch(err) {
        console.error("Error", err);
    }
}

function renderTable(students) {
    const tbody = document.getElementById("students-body");
    tbody.innerHTML = "";
    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted)">لا يوجد طلاب</td></tr>`;
        return;
    }
    students.forEach(s => {
        const statusClass = s.status === 'ناجح' ? 'status-pass' : 'status-fail';
        tbody.innerHTML += `
            <tr>
                <td>${s.seatNumber}</td>
                <td>${s.name}</td>
                <td><strong>${s.finalGrade}%</strong></td>
                <td><span class="${statusClass}">${s.status}</span></td>
            </tr>
        `;
    });
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.style.display = "block";
    if(type === "success") {
        element.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
        element.style.color = "var(--success)";
        element.style.border = "1px solid var(--success)";
    } else {
        element.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
        element.style.color = "var(--error)";
        element.style.border = "1px solid var(--error)";
    }
    setTimeout(() => element.style.display = "none", 5000);
}
