export function getStudentDisplayName(student) {
    const profile = student?.studentProfile || {};
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
        || profile.name
        || student?.email
        || 'Unnamed student';
}

export function getStudentClassKey(student) {
    const profile = student?.studentProfile || {};
    const grade = String(profile.grade || '').trim();
    const section = String(profile.group || '').trim().toUpperCase();
    return grade && section ? `${grade}${section}` : '';
}

export function randomizeStudents(students, groupSize = 2, random = Math.random) {
    const shuffled = [...students];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    const size = Math.max(2, Number.parseInt(groupSize, 10) || 2);
    if (shuffled.length === 0) return [];
    if (shuffled.length <= size) return [shuffled];

    const fullGroupCount = Math.floor(shuffled.length / size);
    const remainder = shuffled.length % size;
    let groupSizes;

    if (remainder === 0) {
        groupSizes = Array(fullGroupCount).fill(size);
    } else if (remainder === 1) {
        groupSizes = [size + 1, ...Array(Math.max(0, fullGroupCount - 1)).fill(size)];
    } else {
        groupSizes = [...Array(fullGroupCount).fill(size), remainder];
    }

    let cursor = 0;
    return groupSizes.map(currentSize => {
        const group = shuffled.slice(cursor, cursor + currentSize);
        cursor += currentSize;
        return group;
    });
}

export function pairKey(studentAId, studentBId) {
    return [String(studentAId || ''), String(studentBId || '')].sort().join(':');
}

function getBalancedGroupSizes(studentCount, groupSize) {
    const size = Math.max(2, Number.parseInt(groupSize, 10) || 2);
    if (studentCount === 0) return [];
    if (studentCount <= size) return [studentCount];

    const fullGroupCount = Math.floor(studentCount / size);
    const remainder = studentCount % size;
    if (remainder === 0) return Array(fullGroupCount).fill(size);
    if (remainder === 1) return [size + 1, ...Array(Math.max(0, fullGroupCount - 1)).fill(size)];
    return [...Array(fullGroupCount).fill(size), remainder];
}

export function randomizeStudentsWithRestrictions(
    students,
    groupSize = 2,
    restrictions = [],
    random = Math.random
) {
    const blockedPairs = new Set(restrictions.map(restriction => pairKey(
        restriction.studentAId ?? restriction.student_a_id,
        restriction.studentBId ?? restriction.student_b_id
    )));
    if (!blockedPairs.size) return randomizeStudents(students, groupSize, random);

    const groupSizes = getBalancedGroupSizes(students.length, groupSize);
    if (!groupSizes.length) return [];

    const degreeByStudent = new Map(students.map(student => [student.id, 0]));
    restrictions.forEach(restriction => {
        const studentAId = restriction.studentAId ?? restriction.student_a_id;
        const studentBId = restriction.studentBId ?? restriction.student_b_id;
        if (degreeByStudent.has(studentAId)) {
            degreeByStudent.set(studentAId, degreeByStudent.get(studentAId) + 1);
        }
        if (degreeByStudent.has(studentBId)) {
            degreeByStudent.set(studentBId, degreeByStudent.get(studentBId) + 1);
        }
    });

    const ordered = students
        .map(student => ({ student, tieBreaker: random() }))
        .sort((left, right) => (
            (degreeByStudent.get(right.student.id) || 0) - (degreeByStudent.get(left.student.id) || 0)
            || left.tieBreaker - right.tieBreaker
        ))
        .map(entry => entry.student);
    const groups = groupSizes.map(() => []);

    function canJoinGroup(student, group) {
        return group.every(member => !blockedPairs.has(pairKey(student.id, member.id)));
    }

    function assignStudent(index) {
        if (index >= ordered.length) return true;
        const student = ordered[index];
        const candidates = groups
            .map((group, groupIndex) => ({ group, groupIndex, tieBreaker: random() }))
            .filter(({ group, groupIndex }) => (
                group.length < groupSizes[groupIndex] && canJoinGroup(student, group)
            ))
            .sort((left, right) => (
                right.group.length - left.group.length
                || left.tieBreaker - right.tieBreaker
            ));

        const triedEmptyCapacities = new Set();
        for (const { group, groupIndex } of candidates) {
            if (group.length === 0) {
                if (triedEmptyCapacities.has(groupSizes[groupIndex])) continue;
                triedEmptyCapacities.add(groupSizes[groupIndex]);
            }
            group.push(student);
            if (assignStudent(index + 1)) return true;
            group.pop();
        }
        return false;
    }

    return assignStudent(0) ? groups : null;
}
