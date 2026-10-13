import { ACTIVITY_DEFINITIONS } from '../activityMetadata.js';

export const PDF_PAGE_FORMAT = "letter";

export const FINAL_REPORT_ACTIVITIES = Object.freeze(
    ACTIVITY_DEFINITIONS.map(({ id, label }) => Object.freeze([id, label]))
);
