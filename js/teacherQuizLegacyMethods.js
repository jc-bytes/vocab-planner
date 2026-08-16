import { $, notifications } from './main.js';
import {
    getVocabSubjectSlug,
    loadManifest
} from './services/vocabularyApi.js';

function installMethods(TeacherManager, MethodsClass) {
    for (const name of Object.getOwnPropertyNames(MethodsClass.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(MethodsClass.prototype, name)
        );
    }
}

class TeacherQuizLegacyMethods {
    // -------------------- Quiz Generation --------------------
    handleGenerateQuiz(force = false) {
        if (!this.vocabSet || !this.vocabSet.words || this.vocabSet.words.length === 0) {
            alert('Load a vocabulary set with words before generating a quiz.');
            return;
        }
        if (!force && this.currentQuiz && this.currentQuiz.vocabId === this.vocabSet.id) {
            // Redirect to new quiz maker instead of showing old preview
            this.openQuizMaker();
        } else {
            // Redirect to new quiz maker
            this.openQuizMaker();
        }
        // $('#quiz-modal').classList.remove('hidden'); // Disable old modal opening
    }

    buildSummativeQuiz(vocab) {
        const words = (vocab.words || []).filter(w => w.word && w.definition);
        const takeRandom = (arr, n) => {
            const copy = [...arr];
            const out = [];
            while (copy.length && out.length < n) {
                const idx = Math.floor(Math.random() * copy.length);
                out.push(copy.splice(idx, 1)[0]);
            }
            return out;
        };

        // True/False
        const tfStatements = [];
        takeRandom(words, Math.min(10, words.length)).forEach(w => {
            const isTrue = Math.random() > 0.5;
            let statement = `${w.word} means "${w.definition}".`;
            if (!isTrue) {
                const wrong = words.find(o => o.word !== w.word);
                if (wrong) statement = `${w.word} means "${wrong.definition}".`;
            }
            tfStatements.push({ text: statement, answer: isTrue ? 'T' : 'F' });
        });

        // Multiple choice
        const mcQuestions = [];
        takeRandom(words, Math.min(10, words.length)).forEach(w => {
            const distractors = takeRandom(words.filter(o => o.word !== w.word), 2);
            const options = [w.word, ...(distractors.map(d => d.word))];
            // shuffle
            const shuffled = options
                .map(val => ({ val, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(o => o.val);
            mcQuestions.push({
                prompt: w.definition,
                options: shuffled,
                answer: w.word
            });
        });

        // Fill-ins
        const fillIns = [];
        takeRandom(words, Math.min(5, words.length)).forEach(w => {
            fillIns.push({
                prompt: `If I need ${w.definition.toLowerCase()}, I need a ____________________.`,
                answer: w.word
            });
        });

        const theme = vocab.name || 'the unit';

        return {
            vocabId: vocab.id,
            title: `${vocab.name || 'Summative Activity'} - Summative #1`,
            criteria: [
                { label: 'Name and date', points: 1 },
                { label: 'Follow Instructions', points: 1 },
                { label: 'Order', points: 1 },
                { label: 'Correct use of tools', points: 1 },
                { label: 'Content', points: 36 }
            ],
            parts: {
                tf: { pointsPer: 1, totalPoints: 10, items: tfStatements },
                mc: { pointsPer: 1, totalPoints: 10, items: mcQuestions },
                fill: { pointsPer: 2, totalPoints: 10, items: fillIns },
                open: { points: 6, prompt: `Using your imagination, design something related to ${theme} and describe its function.` }
            },
            meta: {
                teacher: this.currentUser ? (this.currentUser.displayName || this.currentUser.email || '') : 'Teacher',
                gradeLabel: vocab.grade || (vocab.grades ? vocab.grades.join(', ') : ''),
                date: '______________',
                name: '___________________________',
                activityNumber: '1',
                totalPoints: 40
            }
        };
    }

    renderQuizPreview(quiz) {
        const container = $('#quiz-preview');
        if (!container || !quiz) return;
        const criteriaRows = quiz.criteria.map(c => `<div>${c.label}: ${c.points}pts</div>`).join('');
        const tfHtml = quiz.parts.tf.items.map((item, idx) =>
            `<div class="quiz-question">${idx + 1}. ${item.text} ______</div>`
        ).join('');
        const mcHtml = quiz.parts.mc.items.map((item, idx) => {
            const opts = item.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `<div style="margin-left:1rem;">${letter}) ${opt}</div>`;
            }).join('');
            return `<div class="quiz-question">${idx + 1}. ${item.prompt}<div>${opts}</div></div>`;
        }).join('');
        const fillHtml = quiz.parts.fill.items.map((item, idx) =>
            `<div class="quiz-question">${idx + 1}. ${item.prompt}</div>`
        ).join('');

        container.innerHTML = `
            <div class="quiz-print-area">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:0.4rem;">
                    <div>
                        <div style="font-weight:bold; font-size:1.1rem;">ACADEMIA INTERNACIONAL DE DAVID</div>
                        <div>TECHNOLOGY SUMMATIVE ACTIVITY # ${quiz.meta.activityNumber}</div>
                    </div>
                    <div style="text-align:right; font-size:0.9rem;">
                        Grade: ${quiz.meta.gradeLabel || '____'}<br>
                        Teacher: ${quiz.meta.teacher}
                    </div>
                </div>
                <div class="quiz-header-grid">
                    <div>Name: ${quiz.meta.name}</div>
                    <div>Date: ${quiz.meta.date}</div>
                    <div>Total: ${quiz.meta.totalPoints}pts</div>
                </div>
                <div class="quiz-criteria">
                    ${criteriaRows}
                </div>
                <div class="quiz-section">
                    <h3>PART I: TRUE OR FALSE. (10pts / 1pt each)</h3>
                    ${tfHtml}
                </div>
                <div class="quiz-section">
                    <h3>PART II: CHOOSE THE BEST OPTION. (10pts / 1pt each)</h3>
                    ${mcHtml}
                </div>
                    <div class="quiz-section">
                    <h3>PART III: COMPLETE THE FOLLOWING IF SITUATIONS. (10pts / 2pts each)</h3>
                    ${fillHtml}
                </div>
                <div class="quiz-section">
                    <h3>PART IV: OPEN RESPONSE. (6pts)</h3>
                    <div style="margin:0.5rem 0;">${quiz.parts.open.prompt}</div>
                    <div style="border:1px solid #999; height:120px; margin-top:0.5rem;"></div>
                </div>
            </div>
        `;
    }

    printQuiz() {
        const area = document.querySelector('.quiz-print-area');
        if (!area) return;
        const win = window.open('', '_blank', 'width=900,height=1200');
        win.document.write(`<html><head><title>Summative Quiz</title><style>${document.querySelector('style') ? document.querySelector('style').innerHTML : ''}</style></head><body>${area.outerHTML}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
    }

    async downloadForRepository(vocab) {
        // Confirm with user
        const shouldDownload = confirm(
            `Do you want to download files for the repository?\n\n` +
            `This will download:\n` +
            `1. ${vocab.id}.json (place in vocabularies/)\n` +
            `2. manifest.json (replace in vocabularies/)\n\n` +
            `Then commit and push to GitHub.`
        );

        if (!shouldDownload) return;

        // 1. Download vocabulary JSON file
        const vocabDataStr = JSON.stringify(vocab, null, 2);
        const vocabBlob = new Blob([vocabDataStr], { type: 'application/json' });
        const vocabUrl = URL.createObjectURL(vocabBlob);

        const vocabLink = document.createElement('a');
        vocabLink.href = vocabUrl;
        vocabLink.download = `${vocab.id}.json`;
        document.body.appendChild(vocabLink);
        vocabLink.click();
        document.body.removeChild(vocabLink);
        URL.revokeObjectURL(vocabUrl);

        // 2. Load current manifest and update it
        try {
            let manifest = await loadManifest({ fresh: true });
            if (!manifest) {
                manifest = { vocabularies: [] };
            }

            // Check if vocabulary already exists in manifest
            const existingIndex = manifest.vocabularies.findIndex(v => v.id === vocab.id);

            const manifestEntry = {
                id: vocab.id,
                name: vocab.name,
                description: vocab.description || '',
                subjectSlug: getVocabSubjectSlug(vocab),
                grades: vocab.grades || (vocab.grade ? [vocab.grade] : []),
                assignedDate: vocab.assignedDate || '',
                trimester: vocab.trimester || '',
                month: vocab.month || '',
                week: vocab.week || '',
                path: `vocabularies/${vocab.id}.json`
            };

            if (existingIndex >= 0) {
                manifest.vocabularies[existingIndex] = manifestEntry;
            } else {
                manifest.vocabularies.push(manifestEntry);
            }

            // Download updated manifest
            const manifestDataStr = JSON.stringify(manifest, null, 2);
            const manifestBlob = new Blob([manifestDataStr], { type: 'application/json' });
            const manifestUrl = URL.createObjectURL(manifestBlob);

            const manifestLink = document.createElement('a');
            manifestLink.href = manifestUrl;
            manifestLink.download = 'manifest.json';
            document.body.appendChild(manifestLink);
            manifestLink.click();
            document.body.removeChild(manifestLink);
            URL.revokeObjectURL(manifestUrl);

            // Show instructions
            setTimeout(() => {
                alert(
                    `Files downloaded!\n\n` +
                    `Next steps:\n` +
                    `1. Move ${vocab.id}.json to vocabularies/ folder\n` +
                    `2. Replace vocabularies/manifest.json\n` +
                    `3. Commit and push to GitHub\n\n` +
                    `The vocabulary will then be available everywhere!`
                );
            }, 500);

        } catch (err) {
            console.error('Error updating manifest:', err);
            alert('Downloaded vocabulary file, but could not update manifest. You may need to add it manually.');
        }
    }
    generateSummativeQuiz() {
        const vocab = this.vocabSet;
        if (!vocab || !Array.isArray(vocab.words) || vocab.words.length === 0) {
            notifications.warning('Load a vocabulary with words before generating a quiz.');
            return null;
        }

        const words = vocab.words.map(w => ({
            term: w.word || w.term || '',
            definition: w.definition || w.def || '',
            example: w.example || ''
        })).filter(w => w.term && w.definition);

        if (words.length < 4) {
            notifications.warning('Need at least 4 words with definitions to build a quiz.');
            return null;
        }

        const shuffle = (arr) => arr.map(a => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map(a => a.value);
        const pickDifferent = (arr, exceptIndex) => {
            const filtered = arr.filter((_, i) => i !== exceptIndex);
            return filtered[Math.floor(Math.random() * filtered.length)];
        };

        // Part I: True/False
        const tfItems = [];
        shuffle(words).slice(0, Math.min(10, words.length)).forEach((w, idx) => {
            const isTrue = idx % 2 === 0;
            let statement = `${w.term} ${w.definition}`;
            if (!isTrue) {
                const other = pickDifferent(words, idx);
                statement = `${w.term} ${other.definition}`;
            }
            tfItems.push({ statement, isTrue });
        });

        // Part II: Multiple choice
        const mcItems = [];
        shuffle(words).slice(0, Math.min(10, words.length)).forEach((w) => {
            const distractors = shuffle(words.filter(other => other.term !== w.term)).slice(0, 2);
            const options = shuffle([
                { label: 'A', text: distractors[0] ? distractors[0].term : 'Option A' },
                { label: 'B', text: w.term },
                { label: 'C', text: distractors[1] ? distractors[1].term : 'Option C' }
            ]);
            mcItems.push({
                prompt: `Which word matches: ${w.definition}`,
                options
            });
        });

        // Part III: Fill-ins
        const fillItems = [];
        shuffle(words).slice(0, Math.min(5, words.length)).forEach((w) => {
            fillItems.push({
                prompt: `If I need ${w.definition.toLowerCase()}, I need _____________________.`,
                answer: w.term
            });
        });

        // Part IV: Open response
        const openPrompt = `Using your own imagination, design a concept using the terms in this unit (${words.slice(0, 4).map(w => w.term).join(', ')}). Describe its function.`;

        const header = {
            school: 'ACADEMIA INTERNACIONAL DE DAVID',
            title: 'TECHNOLOGY SUMMATIVE ACTIVITY #1',
            nameLine: 'NAME: ___________________________   DATE: ________________',
            gradeLine: 'Grade: A   B   C',
            teacher: 'TEACHER: ____________________',
            total: 'TOTAL: 40pts'
        };

        const criteria = [
            { label: 'Name and date', points: 1 },
            { label: 'Follow Instructions', points: 1 },
            { label: 'Order', points: 1 },
            { label: 'Correct use of tools', points: 1 },
            { label: 'CONTENT', points: 36 },
            { label: 'TOTAL', points: 40 }
        ];

        return {
            header,
            criteria,
            instructions: 'This is an individual summative activity. Write clearly, follow directions, and answer each section carefully.',
            parts: {
                tf: { instructions: 'PART I: TRUE OR FALSE. Put T or F. (10pts – 1pt each).', items: tfItems },
                mc: { instructions: 'PART II: CHOOSE THE BEST OPTION. Circle the correct letter. (10pts – 1pt each).', items: mcItems },
                fill: { instructions: 'PART III: COMPLETE THE FOLLOWING. (10pts – 2pts each).', items: fillItems },
                open: { instructions: 'PART IV: DESIGN. (6pts)', prompt: openPrompt }
            }
        };
    }

    renderQuizPreview() {
        if (!this.currentQuiz) return;
        const container = $('#quiz-preview');
        if (!container) return;
        const q = this.currentQuiz;

        const criteriaRows = q.criteria.map(c => `<tr><td>${c.label}</td><td style="text-align:right;">${c.points} pts</td></tr>`).join('');

        const tfHtml = q.parts.tf.items.map((item, idx) => `<div class="quiz-question">${idx + 1}. ${item.statement} ________</div>`).join('');
        const mcHtml = q.parts.mc.items.map((item, idx) => `
            <div class="quiz-question">
                ${idx + 1}. ${item.prompt}
                <div class="quiz-options">
                    ${item.options.map(opt => `<div>${opt.label}) ${opt.text}</div>`).join('')}
                </div>
            </div>
        `).join('');
        const fillHtml = q.parts.fill.items.map((item, idx) => `<div class="quiz-question">${idx + 1}. ${item.prompt}</div>`).join('');

        container.innerHTML = `
            <div class="quiz-print-area">
                <div class="quiz-sheet">
                    <div class="quiz-band">
                        <div class="quiz-logo"><img src="./logo.jpeg" alt="Logo"></div>
                        <div class="quiz-band-title">
                            <h2 style="font-weight:700;">${q.header ? q.header.school : 'School Name'}</h2>
                            <h3 style="margin-top:0.2rem; font-weight:600;">${q.header ? q.header.title : 'Quiz Title'}</h3>
                        </div>
                        <div class="quiz-total-box">${q.header ? q.header.total : '0'}</div>
                    </div>
                    <div class="quiz-topline">
                        <div><label>Name:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Date:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Teacher:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Grade:</label><span class="fill">&nbsp;</span></div>
                    </div>
                    <div class="quiz-instructions">
                        <strong>Instructions:</strong>
                        <div style="margin-top:0.35rem;">${q.instructions}</div>
                    </div>
                    <div class="quiz-criteria">
                        <table>
                            <thead><tr><th>Criteria</th><th style="text-align:right;">Points</th></tr></thead>
                            <tbody>${criteriaRows}</tbody>
                        </table>
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.tf.instructions}</h3>
                        ${tfHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.mc.instructions}</h3>
                        ${mcHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.fill.instructions}</h3>
                        ${fillHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.open.instructions}</h3>
                        <div style="margin-bottom:0.5rem;">${q.parts.open.prompt}</div>
                        <div style="height:140px; border:1px solid #d1d5db; border-radius:12px; margin-top:0.5rem; background:#fff;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    printQuiz() {
        const preview = $('#quiz-preview');
        if (!preview) return;
        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>Summative Quiz</title>
                    <style>
                        body { font-family: 'Inter', 'Times New Roman', serif; margin:20px; color:#111; background:#f5f6fb; }
                        .quiz-sheet { width:8.5in; max-width:100%; background:#fff; padding:0.6in; border:1px solid #e5e7eb; border-radius:22px; box-shadow:0 18px 40px -24px rgba(0,0,0,0.2); margin:0 auto; }
                        .quiz-band { display:grid; grid-template-columns:88px 1fr 110px; gap:14px; align-items:center; padding:14px 18px; border-radius:18px; border:1px solid rgba(15,23,42,0.08); background:linear-gradient(135deg,#f8fafc,#eef2ff); }
                        .quiz-logo { width:82px; height:82px; border-radius:18px; background:#fff; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                        .quiz-logo img { width:100%; height:100%; object-fit:contain; }
                        .quiz-total-box { text-align:right; font-weight:700; border:1px solid #e5e7eb; border-radius:12px; padding:0.5rem 0.65rem; background:#f8fafc; }
                        .quiz-topline { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.55rem; margin:0.75rem 0; }
                        .quiz-topline .fill { display:block; padding:0.65rem 0.75rem; border:1px dashed #cbd5e1; border-radius:14px; background:#f8fafc; min-height:40px; }
                        .quiz-topline label { font-size:0.85rem; color:#475569; }
                        .quiz-instructions { border:1px solid #e5e7eb; border-radius:14px; padding:0.75rem 0.9rem; background:#fafafa; margin-bottom:0.75rem; line-height:1.4; }
                        .quiz-criteria { margin: 12px 0 16px; }
                        .quiz-criteria table { width:100%; border-collapse: collapse; }
                        .quiz-criteria th, .quiz-criteria td { border:1px solid #111; padding:6px; text-align:left; }
                        .quiz-section { margin-top:16px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#fafbff; }
                        .quiz-question { margin:6px 0; line-height:1.35; }
                        .quiz-options { margin-left:16px; }
                    </style>
                </head>
                <body>${preview.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}

export function installTeacherQuizLegacyMethods(TeacherManager) {
    installMethods(TeacherManager, TeacherQuizLegacyMethods);
}
