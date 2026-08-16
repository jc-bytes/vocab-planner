import { $, createElement } from '../main.js';

export class StudentActivityGateDisplay {
    constructor(progressFlow) {
        this.progressFlow = progressFlow;
        this.activities = progressFlow.activities;
        this.sm = progressFlow.sm;
    }

    getActivityFlowConfig(...args) {
        return this.progressFlow.getActivityFlowConfig(...args);
    }

    getRequiredCompletion(...args) {
        return this.progressFlow.getRequiredCompletion(...args);
    }

    isActivityComplete(...args) {
        return this.progressFlow.isActivityComplete(...args);
    }

    updateArcadeGateDisplay(status = this.progressFlow.getPendingRequiredWork()) {
        const arcadeTab = $('#student-tab-arcade');
        if (!arcadeTab) return status;

        const existingBadge = arcadeTab.querySelector('.student-arcade-lock-count');
        existingBadge?.remove();
        arcadeTab.classList.toggle('student-tab-locked', status.isBlocked);
        arcadeTab.dataset.locked = status.isBlocked ? 'true' : 'false';
        arcadeTab.setAttribute('aria-disabled', status.isBlocked ? 'true' : 'false');

        if (status.isBlocked) {
            const unitLabel = status.unitCount === 1 ? 'unit' : 'units';
            const activityLabel = status.vocabularyRemainingActivities === 1 ? 'activity' : 'activities';
            const vocabularyMessage = status.vocabularyRemainingActivities > 0
                ? `${status.vocabularyRemainingActivities} required ${activityLabel} in ${status.unitCount} ${unitLabel}`
                : '';
            const sparkMessage = status.spark ? "today's Spark check" : '';
            const workMessage = [sparkMessage, vocabularyMessage].filter(Boolean).join(' and ');
            const message = `Complete ${workMessage} to unlock Arcade.`;
            arcadeTab.title = message;
            arcadeTab.setAttribute('aria-label', `Arcade locked. ${message}`);
            const badge = createElement('span', 'student-arcade-lock-count', String(status.remainingActivities));
            badge.setAttribute('aria-hidden', 'true');
            arcadeTab.appendChild(badge);
        } else {
            arcadeTab.removeAttribute('title');
            arcadeTab.setAttribute('aria-label', 'Arcade');
        }

        return status;
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        const grid = document.querySelector('#activity-menu-view .activities-grid');
        if (!grid) return;

        grid.querySelectorAll(':scope > .unit-loading-state').forEach(state => state.remove());

        const completion = this.getRequiredCompletion(flow);
        const allCards = Array.from(cards);
        const cardByType = new Map(allCards.map(card => [card.dataset.activity, card]));
        const nextActivityType = completion.isComplete
            ? null
            : flow.required.find(activityType => !this.isActivityComplete(activityType));
        const status = $('#required-activities-status');
        if (status) status.remove();

        const staleHeaderCoverage = document.querySelector('#activity-menu-view .section-header #overall-coverage-indicator');
        if (staleHeaderCoverage) staleHeaderCoverage.remove();

        allCards.forEach(card => card.remove());
        grid.querySelectorAll('.activity-flow-section').forEach(section => section.remove());
        grid.style.display = 'block';

        const createSection = (title, className, description = '') => {
            const section = createElement('section', `activity-flow-section ${className}`);
            const headingBlock = createElement('div', 'activity-flow-heading');
            const heading = createElement('h3', null, title);
            headingBlock.appendChild(heading);
            if (description) headingBlock.appendChild(createElement('p', null, description));
            const innerGrid = createElement('div', 'activities-grid-inner');
            section.appendChild(headingBlock);
            section.appendChild(innerGrid);
            grid.appendChild(section);
            return innerGrid;
        };

        const requiredGrid = createSection(
            'Required Path',
            'required-activity-section',
            'Complete these activities to unlock the full practice library.'
        );
        requiredGrid.classList.add('required-activity-path');
        requiredGrid.style.setProperty('--required-count', Math.max(flow.required.length, 1));
        const pathTrack = createElement('div', 'required-path-track');
        const requiredCompletionStates = flow.required.map(activityType => this.isActivityComplete(activityType));
        const getCompletedPathRanges = (completionStates) => {
            const count = completionStates.length;
            if (count === 0) return [];

            const ranges = completionStates
                .map((isComplete, index) => {
                    if (!isComplete) return null;
                    if (count === 1) return [0, 100];

                    const current = (index / (count - 1)) * 100;
                    const previous = index === 0 ? 0 : (((index - 1) / (count - 1)) * 100);
                    const next = index === count - 1 ? 100 : (((index + 1) / (count - 1)) * 100);
                    const start = index === 0 ? 0 : (previous + current) / 2;
                    const end = index === count - 1 ? 100 : (current + next) / 2;
                    return [start, end];
                })
                .filter(Boolean);

            return ranges.reduce((merged, range) => {
                const last = merged[merged.length - 1];
                if (last && range[0] <= last[1]) {
                    last[1] = Math.max(last[1], range[1]);
                } else {
                    merged.push([...range]);
                }
                return merged;
            }, []);
        };
        const completedPathRanges = getCompletedPathRanges(requiredCompletionStates);
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const createPathSvg = (className, viewBox, pathData, clipId, vertical = false) => {
            const svg = document.createElementNS(svgNamespace, 'svg');
            svg.setAttribute('class', className);
            svg.setAttribute('viewBox', viewBox);
            svg.setAttribute('preserveAspectRatio', 'none');

            const defs = document.createElementNS(svgNamespace, 'defs');
            const clipPath = document.createElementNS(svgNamespace, 'clipPath');
            clipPath.setAttribute('id', clipId);
            completedPathRanges.forEach(([start, end]) => {
                const clipRect = document.createElementNS(svgNamespace, 'rect');
                clipRect.setAttribute('x', vertical ? '0' : `${start}%`);
                clipRect.setAttribute('y', vertical ? `${start}%` : '0');
                clipRect.setAttribute('width', vertical ? '100%' : `${end - start}%`);
                clipRect.setAttribute('height', vertical ? `${end - start}%` : '100%');
                clipPath.appendChild(clipRect);
            });
            defs.appendChild(clipPath);

            const basePath = document.createElementNS(svgNamespace, 'path');
            basePath.setAttribute('class', 'required-path-base');
            basePath.setAttribute('d', pathData);
            basePath.setAttribute('pathLength', '100');

            const progressPath = document.createElementNS(svgNamespace, 'path');
            progressPath.setAttribute('class', 'required-path-progress');
            progressPath.setAttribute('d', pathData);
            progressPath.setAttribute('pathLength', '100');
            progressPath.setAttribute('clip-path', `url(#${clipId})`);

            svg.append(defs, basePath, progressPath);
            return svg;
        };
        pathTrack.append(
            createPathSvg(
                'required-path-svg required-path-svg-desktop',
                '0 0 1000 104',
                'M 0 52 C 210 -8 360 -8 500 52 S 790 112 1000 52',
                'required-path-clip-desktop'
            ),
            createPathSvg(
                'required-path-svg required-path-svg-mobile',
                '0 0 84 1000',
                'M 42 0 C -8 210 -8 360 42 500 S 92 790 42 1000',
                'required-path-clip-mobile',
                true
            )
        );
        requiredGrid.appendChild(pathTrack);
        const additionalDetails = createElement('details', 'activity-flow-section additional-activity-section activity-secondary-disclosure activity-disclosure');
        additionalDetails.open = true;
        const additionalSummary = createElement(
            'summary',
            'activity-disclosure__summary',
            completion.isComplete
                ? `Additional Practice (${flow.additional.length})`
                : `Additional Practice (${flow.additional.length}) · locked`
        );
        const additionalGrid = createElement('div', 'activities-grid-inner activity-secondary-grid');
        additionalDetails.appendChild(additionalSummary);
        if (!completion.isComplete) {
            additionalDetails.appendChild(createElement(
                'p',
                'activity-disclosure-note',
                'Finish the required activities first. These are still listed here so you can see what unlocks next.'
            ));
        }
        additionalDetails.appendChild(additionalGrid);

        const unavailableDetails = createElement('details', 'activity-flow-section unavailable-activity-section activity-secondary-disclosure activity-disclosure');
        unavailableDetails.open = false;
        const unavailableSummary = createElement('summary', 'activity-disclosure__summary', `Not Required (${flow.hidden.length})`);
        const unavailableGrid = createElement('div', 'activities-grid-inner activity-secondary-grid activity-unavailable-grid');
        unavailableDetails.appendChild(unavailableSummary);
        unavailableDetails.appendChild(createElement(
            'p',
            'activity-disclosure-note',
            'These activities are visible for reference but are not part of this vocabulary unit.'
        ));
        unavailableDetails.appendChild(unavailableGrid);

        const prepareCard = (card) => {
            if (!card) return;
            const activityType = card.dataset.activity;
            const isRequired = flow.required.includes(activityType);
            const isAdditional = flow.additional.includes(activityType);
            const isHidden = flow.hidden.includes(activityType);
            const hasPlayableContent = this.activities.getActivityPlayableCount(activityType) > 0;
            const requiredIndex = flow.required.indexOf(activityType);
            const isComplete = this.isActivityComplete(activityType);
            const isLockedRequired = isRequired
                && !isComplete
                && !this.activities.isActivityUnlocked(activityType);
            const isLockedAdditional = isAdditional && !completion.isComplete;
            const isLocked = isLockedRequired || isLockedAdditional;
            const isUnavailable = isHidden || !hasPlayableContent;
            card.classList.toggle('required-activity-card', isRequired);
            card.classList.toggle('additional-activity-card', isAdditional);
            card.classList.toggle('activity-locked-card', isLocked);
            card.classList.toggle('activity-unavailable-card', isUnavailable);
            const isNext = activityType === nextActivityType;
            card.classList.toggle('next-activity-card', isNext);
            card.classList.toggle('activity-flow-card-compact', !isNext);
            card.classList.toggle('activity-path-complete', isRequired && isComplete);
            card.disabled = isUnavailable || isLocked;
            card.setAttribute('aria-disabled', card.disabled ? 'true' : 'false');

            const prerequisiteType = isLockedRequired
                ? flow.required.slice(0, requiredIndex).find(type => !this.isActivityComplete(type))
                : null;
            const prerequisiteCard = prerequisiteType ? cardByType.get(prerequisiteType) : null;
            const prerequisiteTitle = prerequisiteCard?.dataset.activityTitle
                || prerequisiteCard?.querySelector('h3')?.textContent?.trim()
                || 'the previous activity';
            card.title = !hasPlayableContent
                ? 'This unit does not have enough suitable words for this activity.'
                : isHidden
                    ? 'Not required for this vocabulary unit.'
                : isLockedRequired
                    ? `Complete ${prerequisiteTitle} first.`
                    : isLockedAdditional
                        ? 'Finish the required activities to unlock this practice.'
                        : '';

            if (isUnavailable && !card.querySelector('.activity-unavailable-label')) {
                card.prepend(createElement(
                    'span',
                    'activity-unavailable-label',
                    hasPlayableContent ? 'Not required' : 'Not enough words'
                ));
            }
            if (isLocked && !card.querySelector('.activity-lock-label')) {
                const lockLabel = isLockedRequired ? `Complete ${prerequisiteTitle} first` : 'Locked';
                card.prepend(createElement('span', 'activity-lock-label', lockLabel));
            }
            if (isRequired) {
                card.prepend(createElement('span', 'activity-path-step', `Step ${requiredIndex + 1}`));
                const statusText = isComplete
                    ? 'Complete'
                    : (!hasPlayableContent ? 'Unavailable' : (isNext ? 'Next' : 'Locked'));
                card.appendChild(createElement('span', 'activity-path-status', statusText));
            }
        };

        flow.required.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) requiredGrid.appendChild(card);
        });

        flow.additional.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) additionalGrid.appendChild(card);
        });

        if (flow.additional.length > 0) grid.appendChild(additionalDetails);

        flow.hidden.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) unavailableGrid.appendChild(card);
        });

        if (flow.hidden.length > 0) grid.appendChild(unavailableDetails);
    }


}
