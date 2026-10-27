import { schoolSessionKey } from './services/schoolScope.js';

const scopedViews = new Set(['classes', 'assignments', 'review', 'groups', 'students', 'student-profile']);

export function installTeacherClassSelectionMethods(TeacherManager, { sessionKey = schoolSessionKey } = {}) {
    Object.assign(TeacherManager.prototype, {
        getSelectedTeacherClassId() {
            const owner = sessionKey(this.currentUser?.uid || this.currentUser?.id);
            if (this.teacherClassSelectionOwner !== owner) {
                this.teacherClassSelectionOwner = owner;
                this.selectedTeacherClassId = null;
                this.teacherClassOptions = [];
                const control = document.getElementById('teacher-class-select');
                if (control) { control.replaceChildren(new Option('Choose a class', '')); control.disabled = true; }
                try { this.selectedTeacherClassId = sessionStorage.getItem(`teacher-class:${owner}`) || null; } catch { /* Selection still works without storage. */ }
            }
            return this.selectedTeacherClassId;
        },
        selectTeacherClass(classId) {
            this.getSelectedTeacherClassId();
            this.selectedTeacherClassId = classId || null;
            try {
                const key = `teacher-class:${this.teacherClassSelectionOwner}`;
                if (classId) sessionStorage.setItem(key, classId); else sessionStorage.removeItem(key);
            } catch { /* Selection still works without storage. */ }
            const select = document.getElementById('teacher-class-select');
            if (select) select.value = classId || '';
            this.updateTeacherClassSwitcher();
        },
        updateTeacherClassSwitcher() {
            const control = document.getElementById('teacher-class-switcher');
            if (!control) return;
            const selected = this.getSelectedTeacherClassId();
            const active = document.querySelector('main.teacher-main > .view.active');
            control.hidden = !this.isAuthenticated || !active
                || ['teacher-login-view', 'teacher-loading-view', 'teacher-administration-view', 'teacher-platform-view', 'teacher-data-management-view'].includes(active.id)
                || (active.id === 'teacher-overview-view' && !selected);
            const classroom = this.teacherClassOptions?.find(c => c.id === selected);
            document.getElementById('teacher-class-name').textContent = classroom?.name || 'Choose a class';
            document.getElementById('teacher-class-year').textContent = classroom
                ? `${classroom.school_year}${classroom.archived ? ' · Archived' : ''}` : 'Switch class';
        },
        resolveTeacherClassRoute(route) {
            if (!scopedViews.has(route.view)) return route;
            const classId = route.classId || this.getSelectedTeacherClassId();
            if (!classId) return { view: 'overview' };
            this.selectTeacherClass(classId);
            if (route.view === 'students') return { view: 'classes', classId, tab: 'students' };
            return { ...route, classId, ...(route.view === 'classes' ? { tab: route.tab || 'work' } : {}) };
        },
        updateTeacherClassOptions(classes) {
            const select = document.getElementById('teacher-class-select');
            if (!select) return;
            const selected = this.getSelectedTeacherClassId();
            this.teacherClassOptions = classes;
            select.replaceChildren(new Option('Choose a class', ''));
            for (const classroom of classes.filter(c => !c.archived || c.id === selected)) {
                select.add(new Option(`${classroom.name} · ${classroom.subject?.name || 'Subject'} · ${classroom.school_year}${classroom.archived ? ' · Archived' : ''}`, classroom.id));
            }
            if (selected && !classes.some(c => c.id === selected)) this.selectTeacherClass(null);
            select.value = this.getSelectedTeacherClassId() || '';
            select.disabled = false;
            this.updateTeacherClassSwitcher();
        },
        changeTeacherClass(classId) {
            this.selectTeacherClass(classId);
            const route = this.parseRoute() || { view: 'overview' };
            if (classId && ['vocabulary', 'sparks', 'editor', 'spark-editor', 'quizzes', 'quiz-editor'].includes(route.view)) {
                if (route.mode === 'review') return this.applyRoute(route);
                return;
            }
            const next = !classId ? { view: 'overview' }
                : route.view === 'classes' ? { view: 'classes', classId, tab: route.tab || 'work' }
                : ['assignments', 'review'].includes(route.view) ? { view: 'assignments', classId, tab: route.listTab || (route.assignmentId ? 'current' : route.tab) }
                : route.view === 'groups' ? { view: 'groups', classId }
                : { view: 'classes', classId, tab: route.view === 'student-profile' ? 'students' : 'work' };
            this.setRoute(next);
            return this.applyRoute(next);
        }
    });
}
