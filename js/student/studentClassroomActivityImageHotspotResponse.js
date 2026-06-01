import { $, escapeHtml, notifications } from '../main.js';
import {
    IMAGE_HOTSPOT_TYPE,
    normalizeImageHotspotResponse,
    normalizeImageHotspotTemplate,
    validateImageHotspotResponse
} from '../activityImageHotspot.js';

class StudentClassroomActivityImageHotspotResponseMethods {
    renderImageHotspotActivity(template, response = {}, imageUrl = '') {
        const normalized = normalizeImageHotspotTemplate(template);
        const normalizedResponse = normalizeImageHotspotResponse(normalized, response);
        const labelMap = new Map(normalized.labels.map(label => [label.id, label]));
        const selectedId = this.selectedHotspotLabelId || normalized.labels[0]?.id || '';
        const placedLabelIds = new Set(normalizedResponse.pins.map(pin => pin.labelId));
        const summary = validateImageHotspotResponse(normalized, normalizedResponse).summary;

        return `
            <div class="image-hotspot-activity-shell">
                <div class="spreadsheet-table-toolbar image-hotspot-toolbar">
                    <div>
                        <strong>${escapeHtml(normalized.labels.length)} labels</strong>
                        <span>${escapeHtml(summary.pinsPlaced)} pins placed · ${escapeHtml(summary.placedRequiredLabels)} / ${escapeHtml(summary.requiredLabels)} required labels</span>
                    </div>
                </div>

                <div class="image-hotspot-student-grid">
                    <div class="image-hotspot-image-frame is-student" data-image-hotspot-stage>
                        ${imageUrl ? `
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(normalized.image.altText || 'Image hotspot activity')}">
                        ` : '<div class="image-hotspot-image-placeholder">Image unavailable.</div>'}
                        <div class="image-hotspot-pin-layer">
                            ${normalizedResponse.pins.map((pin, index) => {
                                const label = labelMap.get(pin.labelId);
                                const color = label?.color || '#2563eb';
                                return `
                                    <button type="button" class="image-hotspot-pin" data-image-hotspot-pin-id="${escapeHtml(pin.id)}" style="--pin-x:${escapeHtml(pin.xPercent)}%; --pin-y:${escapeHtml(pin.yPercent)}%; --pin-color:${escapeHtml(color)};" aria-label="${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}">
                                        <span>${escapeHtml(index + 1)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <aside class="image-hotspot-label-panel">
                        <section>
                            <h4>Labels</h4>
                            <div class="image-hotspot-label-picker">
                                ${normalized.labels.map(label => `
                                    <button type="button" class="${label.id === selectedId ? 'is-selected' : ''} ${placedLabelIds.has(label.id) ? 'is-placed' : ''}" data-image-hotspot-select-label="${escapeHtml(label.id)}" style="--label-color:${escapeHtml(label.color)};">
                                        <span></span>
                                        <strong>${escapeHtml(label.text)}${label.required ? ' *' : ''}${label.hint ? `<small>${escapeHtml(label.hint)}</small>` : ''}</strong>
                                    </button>
                                `).join('')}
                            </div>
                        </section>

                        <section>
                            <h4>Pins</h4>
                            <div class="image-hotspot-pin-list">
                                ${normalizedResponse.pins.map((pin, index) => {
                                    const label = labelMap.get(pin.labelId);
                                    return `
                                        <article data-image-hotspot-pin-row="${escapeHtml(pin.id)}">
                                            <div>
                                                <span class="image-hotspot-pin-number" style="--label-color:${escapeHtml(label?.color || '#2563eb')};">${escapeHtml(index + 1)}</span>
                                                <strong>${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}</strong>
                                                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-pin="${escapeHtml(pin.id)}" aria-label="Delete pin">
                                                    <i data-lucide="trash-2"></i>
                                                </button>
                                            </div>
                                            <textarea rows="2" placeholder="Note" data-image-hotspot-pin-note="${escapeHtml(pin.id)}">${escapeHtml(pin.note)}</textarea>
                                        </article>
                                    `;
                                }).join('') || '<p class="spreadsheet-review-empty">No pins placed yet.</p>'}
                            </div>
                        </section>
                    </aside>
                </div>

                ${normalized.reflectionPrompts.length ? `
                    <section class="spreadsheet-reflection-panel image-hotspot-reflection-panel">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <label class="spreadsheet-reflection-prompt">
                                <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
                                <textarea rows="3" data-image-hotspot-reflection="${escapeHtml(prompt.id)}">${escapeHtml(normalizedResponse.reflections[prompt.id] || '')}</textarea>
                            </label>
                        `).join('')}
                    </section>
                ` : ''}
            </div>
        `;
    }

    getImageHotspotTemplateAndResponse() {
        const template = normalizeImageHotspotTemplate(
            this.currentAssignment?.activityData?.imageHotspotTemplate,
            this.currentAssignment?.activityData?.templateId || 'label-image-parts'
        );
        const response = normalizeImageHotspotResponse(template, this.currentSubmission?.responseData?.imageHotspotResponse || {});
        return { template, response };
    }

    syncImageHotspotResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== IMAGE_HOTSPOT_TYPE) return;
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const root = $('#student-classroom-excalidraw-root');
        if (root) {
            root.querySelectorAll('[data-image-hotspot-pin-note]').forEach(noteEl => {
                const pin = response.pins.find(item => item.id === noteEl.dataset.imageHotspotPinNote);
                if (pin) pin.note = noteEl.value || '';
            });
            root.querySelectorAll('[data-image-hotspot-reflection]').forEach(reflectionEl => {
                response.reflections[reflectionEl.dataset.imageHotspotReflection] = reflectionEl.value || '';
            });
        }
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, response)
        };
    }

    getImageHotspotPoint(event) {
        const stage = event.target.closest('[data-image-hotspot-stage]');
        const image = stage?.querySelector('img');
        if (!stage || !image) return null;
        const rect = image.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const xPercent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
        return { xPercent, yPercent };
    }

    updateImageHotspotPinPosition(pinId, point) {
        if (!pinId || !point) return;
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const pin = response.pins.find(item => item.id === pinId);
        if (!pin) return;
        pin.xPercent = point.xPercent;
        pin.yPercent = point.yPercent;
        pin.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, response)
        };
        const pinEl = $(`[data-image-hotspot-pin-id="${CSS.escape(pinId)}"]`);
        if (pinEl) {
            pinEl.style.setProperty('--pin-x', `${pin.xPercent}%`);
            pinEl.style.setProperty('--pin-y', `${pin.yPercent}%`);
        }
    }

    async refreshImageHotspotActivity() {
        if (!this.currentAssignment || !this.currentSubmission) return;
        await this.mountImageHotspotResponse(this.currentAssignment, this.currentSubmission);
    }

    async placeImageHotspotPin(point) {
        if (!point) return;
        this.syncImageHotspotResponse();
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const selectedLabel = template.labels.find(label => label.id === this.selectedHotspotLabelId) || template.labels[0];
        if (!selectedLabel) return;
        let pins = response.pins;

        if (!template.allowExtraPins) {
            const existing = pins.find(pin => pin.labelId === selectedLabel.id);
            if (existing) {
                existing.xPercent = point.xPercent;
                existing.yPercent = point.yPercent;
                existing.updatedAt = new Date().toISOString();
            } else if (pins.length < template.maxPins) {
                pins.push({
                    id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    labelId: selectedLabel.id,
                    labelText: selectedLabel.text,
                    xPercent: point.xPercent,
                    yPercent: point.yPercent,
                    note: '',
                    updatedAt: new Date().toISOString()
                });
            } else {
                notifications.warning(`Use no more than ${template.maxPins} pins.`);
                return;
            }
        } else if (pins.length < template.maxPins) {
            pins.push({
                id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                labelId: selectedLabel.id,
                labelText: selectedLabel.text,
                xPercent: point.xPercent,
                yPercent: point.yPercent,
                note: '',
                updatedAt: new Date().toISOString()
            });
        } else {
            notifications.warning(`Use no more than ${template.maxPins} pins.`);
            return;
        }

        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, { ...response, pins })
        };
        await this.refreshImageHotspotActivity();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    async handleImageHotspotClick(event) {
        const labelButton = event.target.closest('[data-image-hotspot-select-label]');
        if (labelButton) {
            this.selectedHotspotLabelId = labelButton.dataset.imageHotspotSelectLabel || '';
            $('#student-classroom-excalidraw-root')?.querySelectorAll('[data-image-hotspot-select-label]').forEach(button => {
                button.classList.toggle('is-selected', button.dataset.imageHotspotSelectLabel === this.selectedHotspotLabelId);
            });
            return;
        }

        const deleteButton = event.target.closest('[data-image-hotspot-delete-pin]');
        if (deleteButton) {
            this.syncImageHotspotResponse();
            const { template, response } = this.getImageHotspotTemplateAndResponse();
            response.pins = response.pins.filter(pin => pin.id !== deleteButton.dataset.imageHotspotDeletePin);
            this.currentSubmission.responseData = {
                ...(this.currentSubmission.responseData || {}),
                imageHotspotResponse: normalizeImageHotspotResponse(template, response)
            };
            await this.refreshImageHotspotActivity();
            if (this.editorAutosaveReady) this.queueAutosave();
            return;
        }

        if (this.suppressNextHotspotClick) {
            this.suppressNextHotspotClick = false;
            return;
        }

        if (event.target.closest('[data-image-hotspot-pin-id]')) return;
        if (event.target.closest('[data-image-hotspot-stage]')) {
            await this.placeImageHotspotPin(this.getImageHotspotPoint(event));
        }
    }

    handleImageHotspotInput(event) {
        if (!event.target.closest('.image-hotspot-activity-shell')) return;
        this.syncImageHotspotResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    handleImageHotspotPointerDown(event) {
        const pin = event.target.closest('[data-image-hotspot-pin-id]');
        if (!pin) return;
        this.draggingHotspotPinId = pin.dataset.imageHotspotPinId || '';
        this.suppressNextHotspotClick = false;
        pin.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    handleImageHotspotPointerMove(event) {
        if (!this.draggingHotspotPinId) return;
        const point = this.getImageHotspotPoint(event);
        this.updateImageHotspotPinPosition(this.draggingHotspotPinId, point);
        this.suppressNextHotspotClick = true;
    }

    handleImageHotspotPointerUp(event) {
        if (!this.draggingHotspotPinId) return;
        const pinId = this.draggingHotspotPinId;
        this.updateImageHotspotPinPosition(pinId, this.getImageHotspotPoint(event));
        this.draggingHotspotPinId = '';
        this.syncImageHotspotResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }
}

export function installStudentClassroomActivityImageHotspotResponseMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityImageHotspotResponseMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityImageHotspotResponseMethods.prototype, name)
        );
    }
}
