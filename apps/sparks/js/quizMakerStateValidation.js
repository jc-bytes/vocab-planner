import {
    array,
    boolean,
    check,
    looseObject,
    number,
    optional,
    pipe,
    safeParse,
    string,
    union
} from 'valibot';

import { vocabularySchema } from './services/vocabularyValidation.js';

const numberLikeSchema = union([number(), string()]);
const quizRubricRowSchema = looseObject({
    title: optional(string()),
    desc: optional(string()),
    points: optional(numberLikeSchema)
});
const quizMetaSchema = looseObject({
    title: optional(string()),
    instructions: optional(string()),
    schoolName: optional(string()),
    teacherName: optional(string()),
    grade: optional(string()),
    showBorder: optional(boolean()),
    fontFamily: optional(string()),
    rubric: optional(array(quizRubricRowSchema)),
    date: optional(string()),
    name: optional(string()),
    score: optional(string())
});
const quizSectionSchema = looseObject({
    id: string(),
    type: string(),
    count: optional(numberLikeSchema),
    points: optional(numberLikeSchema),
    choices: optional(numberLikeSchema),
    correct: optional(numberLikeSchema)
});
const quizQuestionSchema = looseObject({});

export const quizMakerStateSchema = pipe(looseObject({
    version: optional(number()),
    meta: optional(quizMetaSchema),
    quizSections: optional(array(quizSectionSchema)),
    questions: optional(array(quizQuestionSchema)),
    sectionIdCounter: optional(numberLikeSchema)
}), check(
    state => Array.isArray(state.quizSections) || Array.isArray(state.questions),
    'Quiz draft must contain sections or questions'
));

export const quizBuilderDraftSchema = looseObject({
    version: optional(number()),
    updatedAt: optional(number()),
    returnTo: optional(string()),
    vocabKey: optional(string()),
    vocabSet: vocabularySchema,
    state: quizMakerStateSchema
});

export function validateQuizMakerState(value) {
    const result = safeParse(quizMakerStateSchema, value);
    return result.success ? result.output : null;
}

export function validateQuizBuilderDraft(value) {
    const result = safeParse(quizBuilderDraftSchema, value);
    return result.success ? result.output : null;
}
