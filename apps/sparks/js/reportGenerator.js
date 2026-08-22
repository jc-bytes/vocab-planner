import { activityReportMethods } from './reports/activityReportRenderer.js';
import { finalReportMethods } from './reports/finalReportRenderer.js';
import { pdfPrimitiveMethods } from './reports/pdfPrimitives.js';
import { reportMetadataMethods } from './reports/reportMetadata.js';
import { wordHuntReportMethods } from './reports/wordHuntReportRenderer.js';

/**
 * Public compatibility facade for report generation.
 *
 * Existing callers continue to use ReportGenerator's static API while the
 * implementation is grouped by report responsibility in ./reports.
 */
export class ReportGenerator {}

Object.assign(
    ReportGenerator,
    reportMetadataMethods,
    pdfPrimitiveMethods,
    activityReportMethods,
    wordHuntReportMethods,
    finalReportMethods
);
