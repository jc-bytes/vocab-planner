import { getActivityLabel } from './activityMetadata.js';
import { assignmentProgressSeries, dashboardActivityChoices, activityAccuracySeries } from './teacherStudentGraphModel.js';

// Each profile owns its charts and pending results. Never reuse a student's chart across profiles.
export function mountStudentDashboardCharts({ root, model, repository, studentId, isCurrent, openWork, selectedKey }) {
    const charts = new Set();
    const choices = dashboardActivityChoices(model);
    const picker = root.querySelector('[data-dashboard-activity-picker]');
    const trend = root.querySelector('[data-dashboard-trend]');
    let disposed = false, request = 0;
    const current = () => !disposed && root.isConnected && isCurrent();
    let choice = choices.find(item => item.key === selectedKey) || choices.find(item => item.recorded) || choices[0];
    if (picker && choice) picker.value = choice.key;
    let library;
    const getChart = () => library ||= import('chart.js/auto').then(module => module.default).catch(error => { library = null; throw error; });
    const color = name => getComputedStyle(root).getPropertyValue(name).trim();
    const baseOptions = () => ({ responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: color('--color-text') } } },
        scales: { x: { ticks: { color: color('--color-text-muted') }, grid: { color: color('--color-border') } },
            y: { ticks: { color: color('--color-text-muted') }, grid: { color: color('--color-border') } } } });
    const destroy = chart => { chart?.destroy(); charts.delete(chart); };
    const progress = assignmentProgressSeries(model);
    async function drawProgress() {
        if (!current() || !progress.length) return;
        try {
            const Chart = await getChart();
            if (!current()) return;
            const options = baseOptions();
            options.indexAxis = 'y';
            options.scales.x.stacked = options.scales.y.stacked = true;
            options.scales.x.beginAtZero = true;
            options.scales.x.ticks.precision = 0;
            options.scales.x.title = { display: true, text: 'Required tasks', color: color('--color-text-muted') };
            options.scales.y.ticks.callback = function(value) {
                const title = this.getLabelForValue(value);
                return title.length > 22 ? `${title.slice(0, 21)}…` : title;
            };
            options.plugins.tooltip = { callbacks: { label: context => `${context.dataset.label}: ${context.raw} of ${progress[context.dataIndex].total} tasks` } };
            options.onClick = (_event, items) => { if (current() && items.length) openWork(progress[items[0].index].id); };
            charts.add(new Chart(root.querySelector('[data-dashboard-progress-chart]'), { type: 'bar', options,
                data: { labels: progress.map(row => row.title), datasets: [
                    { label: 'Completed', data: progress.map(row => row.completed), backgroundColor: color('--color-success') },
                    { label: 'Still to do', data: progress.map(row => row.remaining), backgroundColor: color('--color-text-muted') },
                    { label: 'For your review', data: progress.map(row => row.review), backgroundColor: color('--color-accent') }
                ] } }));
        } catch {
            if (current()) root.querySelector('[data-dashboard-progress-status]').textContent = 'Graph unavailable. The task counts below are still available.';
        }
    }
    let accuracyChart;
    async function drawAccuracy() {
        if (!current()) return;
        const token = ++request;
        destroy(accuracyChart); accuracyChart = null;
        if (!choice || !trend) return;
        trend.replaceChildren();
        const status = document.createElement('p'); status.role = 'status'; status.textContent = 'Loading accuracy…'; trend.append(status);
        const selected = choice;
        try {
            const page = await repository.studentAttempts(studentId, selected.assignmentId, selected.type, 0);
            if (!current() || token !== request) return;
            const series = activityAccuracySeries(page.attempts);
            if (series.points.length < 2) {
                status.textContent = 'Not enough attempts yet. Two finished attempts with comparable accuracy are needed.';
                return;
            }
            const Chart = await getChart();
            if (!current() || token !== request) return;
            status.textContent = `${series.points.length} comparable finished attempts from the latest ${page.attempts.length} recorded attempts · ${series.metricLabel}`;
            const frame = document.createElement('div'); frame.className = 'student-dashboard-chart-frame';
            const canvas = document.createElement('canvas'); canvas.role = 'img'; canvas.setAttribute('aria-label', `${getActivityLabel(selected.type)} accuracy across attempts`);
            frame.append(canvas); trend.append(frame);
            const latest = series.points.at(-1).accuracy, first = series.points[0].accuracy;
            const change = document.createElement('p');
            change.textContent = `Latest accuracy ${Math.round(latest)}% · ${latest > first ? 'Up' : latest < first ? 'Down' : 'No change'}${latest !== first ? ` ${Math.round(Math.abs(latest - first))} percentage points` : ''} since the first attempt shown`;
            trend.append(change);
            const detail = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('ol');
            summary.textContent = 'Show graph values'; detail.append(summary, list);
            series.points.forEach(point => { const item = document.createElement('li'); item.textContent = `${new Date(point.finishedAt).toLocaleString()} · ${point.accuracy}% accuracy`; list.append(item); });
            trend.append(detail);
            const open = document.createElement('button'); open.type = 'button'; open.className = 'btn secondary-btn'; open.textContent = 'Open these attempts';
            open.onclick = () => { if (current()) openWork(selected.assignmentId, selected.type); }; trend.append(open);
            const options = baseOptions();
            options.plugins.legend.display = false;
            options.scales.y.min = 0; options.scales.y.max = 100;
            options.scales.y.ticks.callback = value => `${value}%`;
            options.scales.x.title = { display: true, text: 'Attempts, oldest to newest', color: color('--color-text-muted') };
            options.plugins.tooltip = { callbacks: { title: items => new Date(series.points[items[0].dataIndex].finishedAt).toLocaleString(), label: item => `${item.raw}% accuracy` } };
            options.onClick = (_event, items) => { if (current() && items.length) openWork(selected.assignmentId, selected.type); };
            accuracyChart = new Chart(canvas, { type: 'line', options, data: {
                labels: series.points.map((_, index) => String(index + 1)),
                datasets: [{ label: 'Accuracy', data: series.points.map(point => point.accuracy),
                    borderColor: color('--color-info'), backgroundColor: color('--color-info'), pointRadius: 4, pointHitRadius: 10, tension: 0 }]
            } }); charts.add(accuracyChart);
        } catch {
            if (!current() || token !== request) return;
            trend.replaceChildren();
            const status = document.createElement('p'); status.role = 'alert'; status.textContent = 'Accuracy could not be loaded.';
            const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn secondary-btn'; retry.textContent = 'Retry accuracy'; retry.onclick = () => void drawAccuracy();
            trend.append(status, retry);
        }
    }
    if (picker) picker.onchange = () => { choice = choices.find(item => item.key === picker.value); void drawAccuracy(); };
    void drawProgress(); void drawAccuracy();
    return { get selectedKey() { return choice?.key; }, dispose() { disposed = true; request++; charts.forEach(chart => chart.destroy()); charts.clear(); } };
}
