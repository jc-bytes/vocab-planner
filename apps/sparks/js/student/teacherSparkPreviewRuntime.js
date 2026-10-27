import { mountPreviewDocument } from './teacherPreviewDocument.js';
import { showStudentClassSparks } from './studentClassSparks.js';
import { evaluateSparkAnswers } from '../sparkCheckModel.js';
import { getDefaultSchoolCalendar } from '../services/schoolCalendar.js';
import { refreshIcons } from '../main.js';

export async function mountTeacherSparkPreview(spark, grade) {
    await mountPreviewDocument(['student-sparks-view']);
    const id = spark.id || 'preview-spark';
    const assignment = { id, kind: 'spark', title: spark.title, content: structuredClone(spark),
        release_at: new Date(Date.now() - 1000).toISOString(), withdrawn: false };
    let saved, route = { view: 'sparks', sparkId: id };
    const selection = { selectedId: 'preview-class', classes: [{ id: 'preview-class', archived: false }] };
    const repository = {
        listAssignments: async () => [assignment], readAssignment: async () => assignment,
        listResponses: async () => saved ? [saved] : [],
        async saveResponse(_id, response, revision) {
            saved = { response, revision: revision + 1 }; return saved;
        },
        async checkSpark(_id, answers, revision) {
            const automatic = (spark.questions || []).filter(question => question.type === 'multiple_choice');
            const result = evaluateSparkAnswers(automatic, answers);
            saved = { answers, revision: revision + 1, evaluation: {
                correct: result.correct, automaticTotal: automatic.length,
                needsTeacherReview: (spark.questions || []).some(question => question.type !== 'multiple_choice')
            } };
            return saved;
        }
    };
    const sm = {
        currentUser: { uid: 'teacher-preview' }, studentProfile: { grade }, currentVocab: null,
        activities: { schoolCalendar: getDefaultSchoolCalendar(), vocabularyData: {
            classSelection: selection, async loadClassSelection() {}, renderSubjectPicker(selector) { document.querySelector(selector)?.replaceChildren(); }
        } },
        cleanupActivity() {}, parseRoute: () => route,
        switchView(id) { document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('hidden', view.id !== id); view.classList.toggle('active', view.id === id);
        }); },
        setRoute(next) { route = next; },
        async navigateTo(next) { route = next; await render(); }
    };
    const routing = { sm, gamesGeneration: 0, sparkRepository: repository };
    const render = async () => { await showStudentClassSparks(routing, route); refreshIcons(); };
    window.addEventListener('pagehide', () => routing.sparkReadController?.abort(), { once: true });
    await render();
}
