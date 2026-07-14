import { supabaseService } from '../supabaseService.js';

export const STUDENT_API_METHODS = Object.freeze([
    'init',
    'signInWithPassword',
    'signUpStudent',
    'signOut',
    'onAuthStateChanged',
    'handleRedirectResult',
    'getProfile',
    'updateStudentProfile',
    'updatePasswordAndClearFlag',
    'ensureOwnStudentProgress',
    'submitStudentActivityProgress',
    'syncStudentUnitWork',
    'spendStudentCoins',
    'acceptStudentGiftCoins',
    'claimStudentWelcomeBonus',
    'submitStudentGameScore',
    'buildWordHuntImagePath',
    'uploadWordHuntImage',
    'downloadWordHuntImage'
]);

const delegate = method => (...args) => supabaseService[method](...args);

export const studentApi = Object.freeze(Object.fromEntries(
    STUDENT_API_METHODS.map(method => [method, delegate(method)])
));
