export const REPORT_WIDTH_PX = 816;
export const PDF_PAGE_FORMAT = 'letter';

export function getClassroomActivityPdfStyles() {
    return `
        .classroom-pdf-export,
        .classroom-pdf-export * {
            box-sizing: border-box;
        }

        .classroom-pdf-export {
            width: ${REPORT_WIDTH_PX}px;
            padding: 48px;
            background: #ffffff;
            color: #111827;
            font-family: Inter, Arial, sans-serif;
            line-height: 1.45;
        }

        .classroom-pdf-export h1,
        .classroom-pdf-export h2,
        .classroom-pdf-export h3,
        .classroom-pdf-export h4,
        .classroom-pdf-export p {
            margin-top: 0;
        }

        .classroom-pdf-export p {
            white-space: pre-wrap;
        }

        .pdf-header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 22px;
            border-bottom: 3px solid #2563eb;
        }

        .pdf-header h1 {
            margin-bottom: 8px;
            color: #111827;
            font-size: 28px;
            line-height: 1.12;
        }

        .pdf-header p,
        .pdf-muted {
            color: #6b7280;
            font-size: 13px;
        }

        .pdf-status {
            align-self: flex-start;
            min-width: 160px;
            padding: 10px 12px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 13px;
            font-weight: 800;
            text-align: right;
        }

        .pdf-meta-grid,
        .pdf-instruction-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 20px;
        }

        .pdf-instruction-grid {
            grid-template-columns: 1fr;
        }

        .pdf-meta-card,
        .pdf-section {
            min-width: 0;
            padding: 14px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f9fafb;
        }

        .pdf-label {
            margin: 0 0 5px 0;
            color: #6b7280;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .pdf-value {
            margin: 0;
            color: #111827;
            font-size: 15px;
            font-weight: 700;
        }

        .pdf-work {
            margin-top: 28px;
        }

        .pdf-work h2 {
            margin-bottom: 14px;
            padding-bottom: 9px;
            border-bottom: 1px solid #d1d5db;
            color: #111827;
            font-size: 20px;
        }

        .pdf-canvas-image {
            display: block;
            width: 100%;
            height: auto;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
        }

        .pdf-empty-work {
            padding: 18px;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            color: #64748b;
            font-weight: 700;
            text-align: center;
        }

        .classroom-pdf-export .structured-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .structured-response-block {
            display: grid;
            gap: 8px;
            padding: 14px;
            break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
            color: #111827;
        }

        .classroom-pdf-export .structured-response-block.instructions-block {
            border-color: #bae6fd;
            background: #f0f9ff;
        }

        .classroom-pdf-export .structured-response-block h4 {
            margin: 0;
            color: #111827;
            font-size: 15px;
        }

        .classroom-pdf-export .structured-response-block p {
            margin: 0;
            color: #4b5563;
            font-size: 13px;
        }

        .classroom-pdf-export .structured-response-checklist {
            display: grid;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
        }

        .classroom-pdf-export .structured-response-checklist > div {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 9px 10px;
            border-bottom: 1px solid #e5e7eb;
            color: #111827;
            font-size: 13px;
            font-weight: 700;
        }

        .classroom-pdf-export .structured-response-checklist > div:last-child {
            border-bottom: 0;
        }

        .classroom-pdf-export .structured-response-checklist svg {
            flex: 0 0 16px;
            width: 16px;
            height: 16px;
            color: #64748b;
        }

        .classroom-pdf-export .structured-response-checklist .is-checked svg {
            color: #059669;
        }

        .classroom-pdf-export .structured-answer-readonly {
            min-height: 40px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #f9fafb;
            color: #111827;
            font-size: 13px;
            white-space: pre-wrap;
        }

        .classroom-pdf-export .structured-response-matching,
        .classroom-pdf-export .structured-response-ranking {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .structured-response-matching-row,
        .classroom-pdf-export .structured-response-ranking.readonly > div {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(130px, 0.7fr);
            gap: 10px;
            padding: 9px 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #f9fafb;
            color: #111827;
            font-size: 13px;
        }

        .classroom-pdf-export .structured-response-ranking.readonly > div {
            grid-template-columns: 50px minmax(0, 1fr);
        }

        .classroom-pdf-export .structured-response-table-wrapper {
            overflow: visible;
        }

        .classroom-pdf-export .structured-response-table {
            width: 100%;
            min-width: 0;
            table-layout: fixed;
            border-collapse: collapse;
            border: 1px solid #d1d5db;
            font-size: 12px;
        }

        .classroom-pdf-export .structured-response-table th,
        .classroom-pdf-export .structured-response-table td {
            padding: 8px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            color: #111827;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
        }

        .classroom-pdf-export .structured-response-table th {
            background: #f3f4f6;
            color: #374151;
            font-weight: 800;
        }

        .classroom-pdf-export .spreadsheet-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .spreadsheet-review-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
        }

        .classroom-pdf-export .spreadsheet-review-summary div,
        .classroom-pdf-export .spreadsheet-review-section,
        .classroom-pdf-export .spreadsheet-reflection-review article {
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
            break-inside: avoid;
        }

        .classroom-pdf-export .spreadsheet-review-summary span,
        .classroom-pdf-export .spreadsheet-review-heading span {
            display: block;
            color: #6b7280;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .classroom-pdf-export .spreadsheet-review-summary strong,
        .classroom-pdf-export .spreadsheet-review-heading h4,
        .classroom-pdf-export .spreadsheet-reflection-review strong {
            margin: 0;
            color: #111827;
            font-size: 13px;
        }

        .classroom-pdf-export .spreadsheet-reflection-review {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .spreadsheet-reflection-review p {
            margin: 6px 0 0;
            color: #374151;
            font-size: 12px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview {
            display: grid;
            gap: 7px;
            margin-top: 10px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row {
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr) 54px;
            gap: 8px;
            align-items: center;
            font-size: 11px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row div {
            height: 12px;
            overflow: hidden;
            border-radius: 999px;
            background: #e5e7eb;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row i {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: #2563eb;
        }

        .classroom-pdf-export .image-hotspot-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .image-hotspot-image-frame {
            position: relative;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f8fafc;
            break-inside: avoid;
        }

        .classroom-pdf-export .image-hotspot-image-frame img {
            display: block;
            width: 100%;
            height: auto;
        }

        .classroom-pdf-export .image-hotspot-pin-layer {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }

        .classroom-pdf-export .image-hotspot-pin {
            position: absolute;
            left: var(--pin-x);
            top: var(--pin-y);
            display: inline-flex;
            width: 24px;
            height: 24px;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            border-radius: 999px;
            background: var(--pin-color, #2563eb);
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
            transform: translate(-50%, -100%);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.3);
        }

        .classroom-pdf-export .image-hotspot-review-label-list {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .image-hotspot-review-label-list article {
            display: grid;
            grid-template-columns: 30px minmax(0, 1fr);
            gap: 8px;
            align-items: start;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
            break-inside: avoid;
        }

        .classroom-pdf-export .image-hotspot-pin-number {
            display: inline-flex;
            width: 24px;
            height: 24px;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: var(--label-color, #2563eb);
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
        }

        .classroom-pdf-export .flowchart-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .flowchart-static-canvas {
            position: relative;
            overflow: hidden;
            max-width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #f8fafc;
            break-inside: avoid;
        }

        .classroom-pdf-export .flowchart-static-inner {
            position: relative;
        }

        .classroom-pdf-export .flowchart-static-inner svg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }

        .classroom-pdf-export .flowchart-static-inner path {
            fill: none;
            stroke: #64748b;
            stroke-width: 2;
        }

        .classroom-pdf-export .flowchart-static-node {
            position: absolute;
            width: 156px;
            min-height: 74px;
            padding: 9px 10px;
            border: 2px solid var(--flowchart-node-color, #2563eb);
            border-radius: 8px;
            background: #ffffff;
            color: #111827;
            font-size: 11px;
        }

        .classroom-pdf-export .flowchart-static-node span {
            display: block;
            color: var(--flowchart-node-color, #2563eb);
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .classroom-pdf-export .flowchart-static-node strong {
            display: block;
            margin-top: 4px;
            font-size: 12px;
        }

        .classroom-pdf-export .flowchart-static-node small {
            display: block;
            margin-top: 4px;
            color: #4b5563;
        }

        .classroom-pdf-export .flowchart-static-edge-label {
            position: absolute;
            padding: 2px 6px;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            background: #ffffff;
            color: #334155;
            font-size: 10px;
            font-weight: 800;
            transform: translate(-50%, -50%);
        }
    `;
}
