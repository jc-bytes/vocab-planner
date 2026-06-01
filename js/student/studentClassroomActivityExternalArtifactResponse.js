import { $, escapeHtml, notifications } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import {
    EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES,
    EXTERNAL_ARTIFACT_MAX_BYTES,
    EXTERNAL_ARTIFACT_TYPE,
    externalArtifactAcceptsLink,
    externalArtifactAcceptsUpload,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate,
    validateExternalArtifactResponse
} from '../activityExternalArtifact.js';

class StudentClassroomActivityExternalArtifactResponseMethods {
    renderExternalArtifactActivity(template, response = {}, artifactUrl = '') {
        const normalized = normalizeExternalArtifactTemplate(template);
        const normalizedResponse = normalizeExternalArtifactResponse(normalized, response);
        const validation = validateExternalArtifactResponse(normalized, normalizedResponse);
        const acceptsLink = externalArtifactAcceptsLink(normalized);
        const acceptsUpload = externalArtifactAcceptsUpload(normalized);
        const artifact = normalizedResponse.artifact;
        const artifactIsImage = artifact?.mimeType?.startsWith('image/');
        const artifactLabel = artifact
            ? `${artifact.fileName || 'Uploaded artifact'}${artifact.sizeBytes ? ` · ${Math.round(artifact.sizeBytes / 1024)} KB` : ''}`
            : 'No file uploaded yet.';

        return `
            <div class="external-artifact-activity-shell">
                <div class="spreadsheet-table-toolbar external-artifact-toolbar">
                    <div>
                        <strong>${escapeHtml(normalized.evidenceMode.replace(/\b\w/g, letter => letter.toUpperCase()))} evidence</strong>
                        <span>${validation.valid ? 'Ready to submit' : `${validation.missing.length} item${validation.missing.length === 1 ? '' : 's'} remaining`}</span>
                    </div>
                </div>

                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(normalized.prompt)}</h4>
                    ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
                </section>

                <div class="external-artifact-evidence-grid">
                    ${acceptsLink ? `
                        <label class="external-artifact-link-field">
                            <span>${escapeHtml(normalized.linkLabel)}${['link', 'both'].includes(normalized.evidenceMode) ? ' *' : ''}</span>
                            <input type="url" data-external-artifact-link value="${escapeHtml(normalizedResponse.linkUrl)}" placeholder="https://...">
                        </label>
                    ` : ''}

                    ${acceptsUpload ? `
                        <section class="external-artifact-upload-panel">
                            <div class="structured-builder-items-heading">
                                <div>
                                    <h4>${escapeHtml(normalized.uploadLabel)}${['upload', 'both'].includes(normalized.evidenceMode) ? ' *' : ''}</h4>
                                    <p>PNG, JPG, WebP, or PDF up to 5 MB.</p>
                                </div>
                                <label class="btn secondary-btn image-hotspot-upload-btn">
                                    <i data-lucide="upload"></i>
                                    Upload
                                    <input type="file" accept="${escapeHtml(EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.join(','))}" data-external-artifact-upload>
                                </label>
                            </div>
                            <article class="external-artifact-file-card ${artifact ? '' : 'is-empty'}">
                                ${artifact && artifactIsImage && artifactUrl ? `<img src="${escapeHtml(artifactUrl)}" alt="${escapeHtml(artifact.fileName || 'Uploaded evidence')}">` : '<i data-lucide="file-text"></i>'}
                                <div>
                                    <strong>${escapeHtml(artifactLabel)}</strong>
                                    ${artifact ? `<p>${escapeHtml(artifact.mimeType || 'Unknown file type')}</p>` : '<p>Select a screenshot or PDF from your device.</p>'}
                                    ${artifactUrl ? `<a href="${escapeHtml(artifactUrl)}" target="_blank" rel="noopener noreferrer">Open artifact</a>` : ''}
                                </div>
                                ${artifact ? `
                                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-external-artifact-delete aria-label="Remove uploaded artifact">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                ` : ''}
                            </article>
                        </section>
                    ` : ''}
                </div>

                ${normalized.checklistItems.length ? `
                    <section class="structured-response-block">
                        <h4>Checklist</h4>
                        <div class="structured-response-checklist">
                            ${normalized.checklistItems.map(item => `
                                <label>
                                    <input type="checkbox" data-external-artifact-check="${escapeHtml(item.id)}" ${normalizedResponse.checklist[item.id] ? 'checked' : ''}>
                                    <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                ${normalized.reflectionPrompts.length ? `
                    <section class="spreadsheet-reflection-panel external-artifact-reflection-panel">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <label class="spreadsheet-reflection-prompt">
                                <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
                                <textarea rows="3" data-external-artifact-reflection="${escapeHtml(prompt.id)}">${escapeHtml(normalizedResponse.reflections[prompt.id] || '')}</textarea>
                            </label>
                        `).join('')}
                    </section>
                ` : ''}
            </div>
        `;
    }

    getExternalArtifactTemplateAndResponse() {
        const template = normalizeExternalArtifactTemplate(
            this.currentAssignment?.activityData?.externalArtifactTemplate,
            this.currentAssignment?.activityData?.templateId || 'project-evidence'
        );
        const response = normalizeExternalArtifactResponse(template, this.currentSubmission?.responseData?.externalArtifactResponse || {});
        return { template, response };
    }

    syncExternalArtifactResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== EXTERNAL_ARTIFACT_TYPE) return;
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        const root = $('#student-classroom-excalidraw-root');
        if (root) {
            response.linkUrl = root.querySelector('[data-external-artifact-link]')?.value || '';
            root.querySelectorAll('[data-external-artifact-check]').forEach(checkEl => {
                response.checklist[checkEl.dataset.externalArtifactCheck] = checkEl.checked === true;
            });
            root.querySelectorAll('[data-external-artifact-reflection]').forEach(reflectionEl => {
                response.reflections[reflectionEl.dataset.externalArtifactReflection] = reflectionEl.value || '';
            });
        }
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };
    }

    handleExternalArtifactInput() {
        this.syncExternalArtifactResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    handleExternalArtifactChange(event) {
        if (event.target.matches('[data-external-artifact-upload]')) {
            this.handleExternalArtifactUpload(event);
            return;
        }
        this.handleExternalArtifactInput(event);
    }

    handleExternalArtifactClick(event) {
        if (event.target.closest('[data-external-artifact-delete]')) {
            this.removeExternalArtifactUpload();
        }
    }

    async handleExternalArtifactUpload(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file || !this.currentAssignment || !this.currentSubmission) return;
        this.syncExternalArtifactResponse();

        const mimeType = String(file.type || '').toLowerCase();
        if (!EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.includes(mimeType)) {
            input.value = '';
            this.setSaveStatus('Upload a PNG, JPG, WebP, or PDF file.');
            notifications.warning('Evidence must be a PNG, JPG, WebP, or PDF file.');
            return;
        }
        if (file.size > EXTERNAL_ARTIFACT_MAX_BYTES) {
            input.value = '';
            this.setSaveStatus('Evidence files must be 5 MB or smaller.');
            notifications.warning('Evidence files must be 5 MB or smaller.');
            return;
        }

        try {
            this.setSaveStatus('Uploading evidence...');
            const { template, response } = this.getExternalArtifactTemplateAndResponse();
            const previousPath = response.artifact?.storagePath || '';
            const path = supabaseService.buildExternalArtifactPath({
                studentId: this.currentSubmission.studentId || this.sm.currentUser?.uid,
                assignmentId: this.currentAssignment.id,
                submissionId: this.currentSubmission.id,
                fileName: file.name
            });
            const metadata = await supabaseService.uploadExternalArtifact({ path, file });
            response.artifact = metadata;
            response.updatedAt = new Date().toISOString();
            this.currentSubmission.responseData = {
                ...(this.currentSubmission.responseData || {}),
                externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
            };
            if (previousPath && previousPath !== metadata.storagePath) {
                supabaseService.deleteExternalArtifact(previousPath).catch(error => {
                    console.warn('Could not remove previous evidence artifact:', error);
                });
            }
            await this.saveCurrentSubmission({ notifyOnError: false });
            await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
            this.setSaveStatus('Evidence uploaded.');
        } catch (error) {
            console.error('Failed to upload external artifact:', error);
            this.setSaveStatus('Evidence upload failed.');
            notifications.error('Could not upload evidence. Check your connection and try again.');
        } finally {
            input.value = '';
        }
    }

    async removeExternalArtifactUpload() {
        if (!this.currentAssignment || !this.currentSubmission) return;
        this.syncExternalArtifactResponse();
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        const previousPath = response.artifact?.storagePath || '';
        response.artifact = null;
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };

        try {
            if (previousPath) await supabaseService.deleteExternalArtifact(previousPath);
            await this.saveCurrentSubmission({ notifyOnError: false });
            await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
            this.setSaveStatus('Evidence removed.');
        } catch (error) {
            console.error('Failed to remove external artifact:', error);
            notifications.error('Could not remove evidence.');
            this.setSaveStatus('Could not remove evidence.');
        }
    }
}

export function installStudentClassroomActivityExternalArtifactResponseMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityExternalArtifactResponseMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityExternalArtifactResponseMethods.prototype, name)
        );
    }
}
