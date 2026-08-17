import { teacherWordHuntReviewDataMethods } from './teacherWordHuntReview/teacherWordHuntReviewDataMethods.js';
import { teacherWordHuntReviewImageMethods } from './teacherWordHuntReview/teacherWordHuntReviewImageMethods.js';
import { teacherWordHuntReviewInteractionMethods } from './teacherWordHuntReview/teacherWordHuntReviewInteractionMethods.js';
import { teacherWordHuntReviewStateMethods } from './teacherWordHuntReview/teacherWordHuntReviewStateMethods.js';
import { teacherWordHuntReviewViewMethods } from './teacherWordHuntReview/teacherWordHuntReviewViewMethods.js';

const teacherWordHuntReviewMethodGroups = [
    teacherWordHuntReviewDataMethods,
    teacherWordHuntReviewStateMethods,
    teacherWordHuntReviewViewMethods,
    teacherWordHuntReviewInteractionMethods,
    teacherWordHuntReviewImageMethods
];

/**
 * Installs the lazy Word Hunt review feature without changing TeacherManager's
 * existing public interface.
 */
export function installTeacherWordHuntReviewMethods(TeacherManager) {
    teacherWordHuntReviewMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(TeacherManager.prototype, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}
