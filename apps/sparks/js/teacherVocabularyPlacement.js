class TeacherVocabularyPlacementMethods {
    getVocabGrades(vocab) {
        const explicitGrades = Array.isArray(vocab?.grades) ? vocab.grades : [vocab?.grades, vocab?.grade, vocab?.gradeLevel];
        const cleanedGrades = explicitGrades
            .flatMap(grade => {
                if (grade === null || grade === undefined) return [];
                return String(grade).split(',');
            })
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);

        if (cleanedGrades.length > 0) {
            return Array.from(new Set(cleanedGrades));
        }

        const source = `${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const inferredGrade = source.match(/\bgrade\s*([0-9]{1,2})(?=\D|$)/i);
        return inferredGrade ? [inferredGrade[1]] : ['Other'];
    }

    normalizeGradeLabel(grade) {
        if (grade === null || grade === undefined) return '';
        const value = String(grade).trim();
        if (!value) return '';
        return value.replace(/^grade\s*/i, '').trim() || value;
    }

    compareGradeLabels(gradeA, gradeB) {
        const valueA = this.getGradeSortValue(gradeA);
        const valueB = this.getGradeSortValue(gradeB);

        if (valueA !== valueB) {
            return valueA - valueB;
        }

        return this.formatGradeLabel(gradeA).localeCompare(this.formatGradeLabel(gradeB));
    }

    getGradeSortValue(grade) {
        const match = String(grade || '').match(/[0-9]+/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
    }

    formatGradeLabel(grade) {
        const value = String(grade || '').trim();
        return /^[0-9]+$/.test(value) ? `Grade ${value}` : value;
    }

    getTeacherTrimesterKey(vocabOrTrimester) {
        const isVocab = vocabOrTrimester && typeof vocabOrTrimester === 'object';
        const rawTrimester = isVocab ? vocabOrTrimester.trimester : vocabOrTrimester;
        const normalized = this.normalizeTeacherTrimester(rawTrimester);

        if (isVocab && vocabOrTrimester.assignedDate && !rawTrimester) {
            return 'other';
        }

        if (normalized !== 'other' || !isVocab) {
            return normalized;
        }

        const source = `${vocabOrTrimester.id || ''} ${vocabOrTrimester.name || ''} ${vocabOrTrimester.path || ''}`;
        const shorthandMatch = source.match(/(?:^|[\s_-])t\s*([123])(?:[\s_-]|$)/i);
        const wordMatch = source.match(/\btrimester\s*([123])\b/i);
        const inferred = shorthandMatch?.[1] || wordMatch?.[1] || '';
        return this.normalizeTeacherTrimester(inferred);
    }

    normalizeTeacherTrimester(trimester) {
        const value = String(trimester || '').trim().toUpperCase().replace(/\s+/g, '');

        if (['1', 'T1', 'IT', 'I', 'FIRST', '1ST'].includes(value)) return 'IT';
        if (['2', 'T2', 'IIT', 'II', 'SECOND', '2ND'].includes(value)) return 'IIT';
        if (['3', 'T3', 'IIIT', 'III', 'THIRD', '3RD'].includes(value)) return 'IIIT';
        return 'other';
    }

    getTeacherTrimesterLabel(trimesterKey) {
        const labels = {
            IT: '1st Trimester',
            IIT: '2nd Trimester',
            IIIT: '3rd Trimester',
            other: 'Other'
        };

        return labels[trimesterKey] || labels.other;
    }

    getTeacherTrimesterShortLabel(trimesterKey) {
        const labels = {
            IT: 'T1',
            IIT: 'T2',
            IIIT: 'T3',
            other: 'Other'
        };

        return labels[trimesterKey] || labels.other;
    }

    getTeacherTrimesterOrder(trimesterKey) {
        const order = {
            IT: 1,
            IIT: 2,
            IIIT: 3,
            other: 99
        };

        return order[trimesterKey] || order.other;
    }

    buildMonthGroups(vocabItems = []) {
        const monthGroups = new Map();

        vocabItems.forEach(({ vocab, type }) => {
            const monthKey = this.getTeacherMonthKey(vocab);
            if (!monthGroups.has(monthKey)) {
                monthGroups.set(monthKey, []);
            }

            monthGroups.get(monthKey).push({ vocab, type });
        });

        return monthGroups;
    }

    getTeacherMonthKey(vocab) {
        const explicitMonth = this.normalizeTeacherMonth(vocab?.month);
        if (explicitMonth !== 'other') return explicitMonth;
        if (vocab?.assignedDate) return 'other';

        const source = `${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const monthMatch = source.match(/(?:^|[^a-z])(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?=[^a-z]|$)/i);
        return this.normalizeTeacherMonth(monthMatch?.[1]);
    }

    normalizeTeacherMonth(month) {
        const value = String(month || '').trim().toLowerCase();
        const aliases = {
            january: 'january',
            jan: 'january',
            february: 'february',
            feb: 'february',
            march: 'march',
            mar: 'march',
            april: 'april',
            apr: 'april',
            may: 'may',
            june: 'june',
            jun: 'june',
            july: 'july',
            jul: 'july',
            august: 'august',
            aug: 'august',
            september: 'september',
            sept: 'september',
            sep: 'september',
            october: 'october',
            oct: 'october',
            november: 'november',
            nov: 'november',
            december: 'december',
            dec: 'december'
        };

        return aliases[value] || 'other';
    }

    getTeacherMonthLabel(monthKey) {
        const labels = {
            january: 'January',
            february: 'February',
            march: 'March',
            april: 'April',
            may: 'May',
            june: 'June',
            july: 'July',
            august: 'August',
            september: 'September',
            october: 'October',
            november: 'November',
            december: 'December',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getTeacherMonthShortLabel(monthKey) {
        const labels = {
            january: 'Jan',
            february: 'Feb',
            march: 'Mar',
            april: 'Apr',
            may: 'May',
            june: 'Jun',
            july: 'Jul',
            august: 'Aug',
            september: 'Sep',
            october: 'Oct',
            november: 'Nov',
            december: 'Dec',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getTeacherMonthOrder(monthKey) {
        const order = {
            january: 1,
            february: 2,
            march: 3,
            april: 4,
            may: 5,
            june: 6,
            july: 7,
            august: 8,
            september: 9,
            october: 10,
            november: 11,
            december: 12,
            other: 99
        };

        return order[monthKey] || order.other;
    }

    formatMonthSummary(monthGroups) {
        return Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getTeacherMonthOrder(monthA) - this.getTeacherMonthOrder(monthB))
            .map(([monthKey, vocabItems]) => `${this.getTeacherMonthShortLabel(monthKey)}: ${vocabItems.length}`)
            .join(' · ');
    }

    getVocabSortName(vocab) {
        return String(vocab?.name || vocab?.id || '').toLocaleLowerCase();
    }

    getVocabPlacementSortValue(vocab) {
        if (vocab?.assignedDate) return String(vocab.assignedDate);
        const week = Number(vocab?.week || this.inferTeacherWeek(vocab) || 99);
        return `${String(week).padStart(2, '0')}-${this.getVocabSortName(vocab)}`;
    }

    compareVocabPlacement(vocabA, vocabB) {
        const placementA = this.getVocabPlacementSortValue(vocabA);
        const placementB = this.getVocabPlacementSortValue(vocabB);

        if (placementA !== placementB) {
            return placementA.localeCompare(placementB);
        }

        return this.getVocabSortName(vocabA).localeCompare(this.getVocabSortName(vocabB));
    }

    formatVocabPlacementLabel(vocab) {
        const trimester = this.getTeacherTrimesterKey(vocab);
        const week = vocab?.week || this.inferTeacherWeek(vocab);
        if (trimester !== 'other' && week) return `Week ${week} of ${trimester}`;
        if (trimester !== 'other') return trimester;
        return '';
    }

    formatUnitCount(count) {
        return `${count} ${count === 1 ? 'unit' : 'units'}`;
    }
}

export function installTeacherVocabularyPlacementMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyPlacementMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyPlacementMethods.prototype, name)
        );
    }
}
