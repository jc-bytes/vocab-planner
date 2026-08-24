import '../css/teacherQuiz.css';
import { installTeacherQuizBrowserMethods } from './teacherQuizBrowserMethods.js';
import { installTeacherQuizCoreMethods } from './teacherQuizCoreMethods.js';

export function installTeacherQuizMethods(TeacherManager) {
    installTeacherQuizCoreMethods(TeacherManager);
    installTeacherQuizBrowserMethods(TeacherManager);
}
