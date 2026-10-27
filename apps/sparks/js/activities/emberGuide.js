// Presentation only: activity progress and answer rules remain with the activity.
const poses = {
    step: ['01-follow-this-step', 'Follow this step'],
    example: ['02-let-me-show-you', 'Let me show you'],
    calm: ['03-take-your-time', 'Take your time'],
    clue: ['04-try-this-clue', 'Try this clue'],
    correct: ['05-you-got-it', 'You got it'],
    complete: ['06-activity-complete', 'Activity complete']
};

export function createEmberGuide({ state, message, example, collapsed = false, onCollapse }) {
    const guide = document.createElement('details');
    guide.className = 'ember-guide';
    guide.open = !collapsed;
    const summary = document.createElement('summary');
    summary.textContent = 'Ember guide';
    guide.append(summary);
    guide.addEventListener('toggle', () => onCollapse?.(!guide.open));

    const body = document.createElement('div');
    body.className = 'ember-guide-body';
    const image = document.createElement('img');
    image.alt = '';
    image.width = 112;
    image.height = 112;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    const text = document.createElement('p');
    text.setAttribute('aria-live', 'polite');
    function show(pose, words) {
        const [file, label] = poses[pose];
        image.src = new URL(`../../assets/ember/${file}.webp`, import.meta.url).href;
        guide.dataset.pose = pose;
        title.textContent = label;
        text.textContent = words;
    }
    show(state, message);
    copy.append(title, text);
    if (example) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn secondary-btn ember-example-button';
        button.textContent = 'Show example';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            const showing = button.getAttribute('aria-pressed') !== 'true';
            show(showing ? 'example' : state, showing ? example : message);
            button.setAttribute('aria-pressed', String(showing));
            button.textContent = showing ? 'Back to step' : 'Show example';
        });
        copy.append(button);
    }
    body.append(image, copy);
    guide.append(body);
    return guide;
}
