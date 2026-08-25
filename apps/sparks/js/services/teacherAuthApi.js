import { supabaseService } from '../supabaseService.js';

export const TEACHER_AUTH_API_METHODS = Object.freeze([
    'init',
    'getCurrentUser',
    'onAuthStateChanged',
    'completeEmailSignIn',
    'signOut',
    'getProfile',
    'ensureAllowlistedTeacherProfile',
    'signInWithPassword',
    'signUpTeacher',
    'sendEmailSignInLink'
]);

const delegate = method => (...args) => supabaseService[method](...args);

export const teacherAuthApi = Object.freeze(Object.fromEntries(
    TEACHER_AUTH_API_METHODS.map(method => [method, delegate(method)])
));
