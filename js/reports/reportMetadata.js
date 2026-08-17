import { FINAL_REPORT_ACTIVITIES } from "./reportConstants.js";

export const reportMetadataMethods = {
    getStudentInfo(studentProfile = {}) {
        const fullName = studentProfile.firstName && studentProfile.lastName
            ? `${studentProfile.firstName} ${studentProfile.lastName}`
            : studentProfile.name || 'Student';
        const grade = studentProfile.grade ?? studentProfile.gradeLevel ?? studentProfile.grade_level ?? '';
        const group = studentProfile.group ?? studentProfile.sectionLetter ?? studentProfile.section_letter ?? '';
        return { fullName, grade, group };
    },

    getVocabName(vocabOrName) {
        return typeof vocabOrName === 'string' ? vocabOrName : (vocabOrName?.name || 'Vocabulary');
    },

    getSubjectName(vocabOrName) {
        if (!vocabOrName || typeof vocabOrName === 'string') return 'Technology';
        if (vocabOrName.subjectName) return vocabOrName.subjectName;
        const slug = String(vocabOrName.subjectSlug || vocabOrName.subject_slug || 'technology');
        return slug
            .split('-')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Technology';
    },

    getWordHuntWords(vocabOrName) {
        const allWords = Array.isArray(vocabOrName?.words) ? vocabOrName.words : [];
        const settings = vocabOrName?.activitySettings || {};
        const wordHuntIsRequired = Array.isArray(settings.requiredActivities)
            && settings.requiredActivities.includes('illustration');
        if (wordHuntIsRequired && settings.wordHuntSelectionMode !== 'custom') {
            return allWords;
        }

        const selectedWords = allWords.filter(word => (
            word.wordHunt === true ||
            word.wordHunt === 'true' ||
            word.word_hunt === true
        ));
        const fallbackLimit = vocabOrName?.activitySettings?.illustration || 5;
        return selectedWords.length > 0 ? selectedWords : allWords.slice(0, fallbackLimit);
    },

    mergeSavedWordHuntWords(words = [], wordHunt = {}) {
        const merged = [];
        const seen = new Set();

        words.forEach(wordObj => {
            const normalized = typeof wordObj === 'string' ? { word: wordObj } : wordObj;
            const word = String(normalized?.word || '').trim();
            if (!word || seen.has(word)) return;
            seen.add(word);
            merged.push(normalized);
        });

        Object.keys(wordHunt || {}).forEach(word => {
            const normalizedWord = String(word || '').trim();
            if (!normalizedWord || seen.has(normalizedWord)) return;
            seen.add(normalizedWord);
            merged.push({ word: normalizedWord });
        });

        return merged;
    },

    slugForDownload(value) {
        return String(value || 'word-hunt')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'word-hunt';
    },

    toPascalFileSegment(value, fallback = 'WordHunt') {
        const parts = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean);

        if (parts.length === 0) return fallback;

        return parts.map(part => {
            const lower = part.toLowerCase();
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join('');
    },

    getGradeGroupFileSegment(grade, group) {
        const groupText = String(group || '').replace(/[^a-zA-Z0-9]+/g, '');
        const gradeText = groupText
            ? (String(grade || '').match(/\d+/)?.[0] || String(grade || '').replace(/[^a-zA-Z0-9]+/g, ''))
            : String(grade || '').replace(/[^a-zA-Z0-9]+/g, '');
        return `${gradeText}${groupText}`.toLowerCase() || 'class';
    },

    getTrimesterFileSegment(vocabOrName, options = {}) {
        const raw = String(
            options.trimester
            || vocabOrName?.trimester
            || vocabOrName?.trimesterKey
            || vocabOrName?.trimester_key
            || ''
        ).trim().toUpperCase();

        if (!raw) return '';
        if (raw === 'IT' || raw === 'T1' || raw === '1') return 't1';
        if (raw === 'IIT' || raw === 'T2' || raw === '2') return 't2';
        if (raw === 'IIIT' || raw === 'T3' || raw === '3') return 't3';

        return raw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .replace(/^trimester/, 't');
    },

    buildWordHuntFileName(studentProfile, vocabOrName, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);
        const segments = [
            this.toPascalFileSegment(fullName, 'Student'),
            this.getGradeGroupFileSegment(grade, group),
            this.getTrimesterFileSegment(vocabOrName, options),
            this.toPascalFileSegment(vocabName, 'Vocabulary')
        ].filter(Boolean);

        return `${segments.join('-')}.pdf`;
    },

    buildFinalReportFileName(studentProfile, vocabOrName, options = {}) {
        const baseName = this.buildWordHuntFileName(studentProfile, vocabOrName, options).replace(/\.pdf$/i, '');
        return `${baseName}-FinalReport.pdf`;
    },

    getActivityLabel(activityType) {
        return FINAL_REPORT_ACTIVITIES.find(([key]) => key === activityType)?.[1]
            || String(activityType || 'Activity').replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    },

    buildActivityReportFileName(studentProfile, vocabOrName, activityType, options = {}) {
        const baseName = this.buildWordHuntFileName(studentProfile, vocabOrName, options).replace(/\.pdf$/i, '');
        const activityName = this.toPascalFileSegment(this.getActivityLabel(activityType), 'Activity');
        return `${baseName}-${activityName}.pdf`;
    },

    normalizeActivityReportScoreData(scoreData = {}) {
        const nestedDetails = scoreData?.details && typeof scoreData.details === 'object'
            ? scoreData.details
            : null;
        let summary = typeof scoreData?.details === 'string' ? scoreData.details.trim() : '';
        if (!summary && typeof nestedDetails?.summary === 'string') {
            summary = nestedDetails.summary.trim();
        }
        if (!summary && nestedDetails) {
            summary = Object.entries(nestedDetails)
                .filter(([key, value]) => key !== 'evidence' && key !== 'summary' && value !== null && value !== '')
                .map(([key, value]) => `${key.replace(/[-_]/g, ' ')}: ${String(value)}`)
                .join(' | ');
        }

        const topLevelEvidence = scoreData?.evidence && typeof scoreData.evidence === 'object'
            ? scoreData.evidence
            : null;
        const nestedEvidence = nestedDetails?.evidence && typeof nestedDetails.evidence === 'object'
            ? nestedDetails.evidence
            : null;
        const evidence = { ...(nestedEvidence || {}), ...(topLevelEvidence || {}) };
        if (evidence.accuracy === undefined && scoreData?.accuracy !== undefined && scoreData.accuracy !== null) {
            evidence.accuracy = scoreData.accuracy;
        }

        return {
            ...scoreData,
            details: summary || 'Activity completed.',
            evidence
        };
    },

    getActivityEvidenceRows(scoreData = {}) {
        const evidence = this.normalizeActivityReportScoreData(scoreData).evidence;
        return Object.entries(evidence)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => ({
                label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, letter => letter.toUpperCase()),
                value: Array.isArray(value) ? value.join(', ') : String(value)
            }));
    },
};

