import Papa from 'papaparse';
import { $, notifications } from '../main.js';
import { supabaseService } from '../supabaseService.js';
import { setInlineStatus } from '../ui/inlineStatus.js';

export async function importStudentRecordsWithConcurrency(
    records,
    createAccount,
    { concurrency = 3, onProgress = () => {} } = {}
) {
    const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), records.length);
    const failuresByIndex = new Map();
    let nextIndex = 0;
    let completed = 0;
    let created = 0;

    const worker = async () => {
        while (nextIndex < records.length) {
            const index = nextIndex;
            nextIndex += 1;
            const record = records[index];
            try {
                await createAccount(record.profile, record.password);
                created += 1;
            } catch (error) {
                failuresByIndex.set(index, {
                    record,
                    message: error.message || 'Could not create account.'
                });
            } finally {
                completed += 1;
                onProgress({ completed, total: records.length, record });
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return {
        created,
        failed: [...failuresByIndex.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, failure]) => failure)
    };
}

export const teacherStudentCsvImportMethods = {
    showStudentCsvPicker() {
        if (this.authDisabled) {
            notifications.warning('CSV import can only create accounts when Supabase auth is enabled.');
            return;
        }

        if (!this.ensureAuthenticated(false)) return;
        this.updateStudentImportStatus('');
        $('#student-csv-input')?.click();
    },

updateStudentImportStatus(message, state = 'muted') {
        const status = $('#student-roster-import-status');
        if (!status) return;

        setInlineStatus(status, message, state);
    },

async handleStudentCsvImportFiles(fileList) {
        const files = Array.from(fileList || []).filter(file => /\.csv$/i.test(file.name));
        if (files.length === 0) return;

        let records = [];
        try {
            this.updateStudentImportStatus(`Reading ${files.length} CSV file${files.length === 1 ? '' : 's'}...`);
            const recordGroups = await Promise.all(files.map(file => this.parseStudentCsvFile(file)));
            records = recordGroups.flat();
        } catch (error) {
            console.error('Failed to read student CSV files:', error);
            this.updateStudentImportStatus(error.message || 'Could not read the selected CSV files.', 'error');
            return;
        }

        if (records.length === 0) {
            this.updateStudentImportStatus('No student rows were found in the selected CSV files.', 'error');
            return;
        }

        const confirmed = confirm(
            `Create ${records.length} student account${records.length === 1 ? '' : 's'} from ${files.length} CSV file${files.length === 1 ? '' : 's'}?`
        );
        if (!confirmed) {
            this.updateStudentImportStatus('');
            return;
        }

        const importButton = $('#import-student-csv-btn');
        let created = 0;
        let failed = [];

        try {
            if (importButton) importButton.disabled = true;
            const result = await importStudentRecordsWithConcurrency(
                records,
                (profile, password) => supabaseService.createStudentAccount(profile, password),
                {
                    concurrency: 3,
                    onProgress: ({ completed, total, record }) => {
                        this.updateStudentImportStatus(
                            `Processed ${completed} of ${total}: ${record.profile.firstName} ${record.profile.lastName} (${record.profile.grade}${record.profile.group})...`
                        );
                    }
                }
            );
            created = result.created;
            failed = result.failed;

            if (created > 0) {
                this.studentProgressCache = null;
                await this.loadStudentRosterFilters({ forceRefresh: true });
                this.populateFilters();
                await this.fetchStudentProgressPage({ forceRefresh: true });
                this.populateFilters();
                this.applyFilters();
            }

            const summary = `${created} created${failed.length ? `, ${failed.length} skipped or failed` : ''}.`;
            if (failed.length) {
                const sample = failed
                    .slice(0, 3)
                    .map(item => `${item.record.profile.email}: ${item.message}`)
                    .join(' | ');
                this.updateStudentImportStatus(`${summary} ${sample}`, 'error');
                notifications.warning(summary);
            } else {
                this.updateStudentImportStatus(summary, 'success');
                notifications.success(summary);
            }
        } finally {
            if (importButton) importButton.disabled = false;
        }
    },

async parseStudentCsvFile(file) {
        const placement = this.getGradeSectionFromStudentCsvName(file.name);
        if (!placement) {
            throw new Error(`${file.name} must be named like 6A.csv, 7B.csv, etc.`);
        }

        const text = await file.text();
        return this.parseStudentCsvText(text, file.name, placement);
    },

getGradeSectionFromStudentCsvName(fileName) {
        const match = String(fileName || '').trim().match(/^([6-9])([a-z])(?:\b|\.|_|-)/i);
        if (!match) return null;
        return {
            grade: match[1],
            section: match[2].toUpperCase()
        };
    },

parseStudentCsvText(text, fileName, placement) {
        const rows = this.parseCsvRows(text);
        if (rows.length < 2) return [];

        const headers = rows[0].map(header => this.normalizeStudentCsvHeader(header));
        return rows.slice(1).map((cells, index) => {
            const row = new Map();
            headers.forEach((header, cellIndex) => {
                row.set(header, String(cells[cellIndex] || '').trim());
            });

            return this.normalizeStudentCsvRecord(row, fileName, index + 2, placement);
        });
    },

parseCsvRows(text) {
        const source = String(text || '').replace(/^\uFEFF/, '');
        const parsed = Papa.parse(source, {
            skipEmptyLines: 'greedy'
        });
        if (parsed.errors.length) {
            const firstError = parsed.errors[0];
            const rowLabel = Number.isInteger(firstError.row) ? ` at row ${firstError.row + 1}` : '';
            throw new Error(`Invalid CSV${rowLabel}: ${firstError.message}`);
        }
        return parsed.data;
    },

normalizeStudentCsvHeader(header) {
        return String(header || '')
            .replace(/^\uFEFF/, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    },

getStudentCsvValue(row, keys) {
        for (const key of keys) {
            const normalizedKey = this.normalizeStudentCsvHeader(key);
            const value = row.get(normalizedKey);
            if (value) return value;
        }
        return '';
    },

normalizeStudentCsvRecord(row, fileName, rowNumber, placement) {
        const firstName = this.getStudentCsvValue(row, ['primer nombre', 'first name', 'firstname', 'nombre']);
        const lastName = this.getStudentCsvValue(row, ['primer apellido', 'last name', 'lastname', 'apellido']);
        const email = this.getStudentCsvValue(row, ['correo', 'email', 'e-mail', 'correo electronico']).toLowerCase();
        const password = this.getStudentCsvValue(row, ['contrasena', 'contraseña', 'password', 'pass']);

        if (!firstName || !lastName || !email || !password) {
            throw new Error(`${fileName}, row ${rowNumber}: first name, last name, email, and password are required.`);
        }

        return {
            sourceFile: fileName,
            rowNumber,
            profile: {
                firstName,
                lastName,
                email,
                grade: placement.grade,
                group: placement.section
            },
            password
        };
    }
};
