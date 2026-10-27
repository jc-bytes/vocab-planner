import { STUDENT_ACTIVITY_REGISTRY } from './studentActivityRegistry.js';

export function renderStudentActivityCards(container) {
    if (!container) return;

    container.replaceChildren(...STUDENT_ACTIVITY_REGISTRY.map(activity => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card activity-card';
        card.dataset.activity = activity.id;

        const icon = document.createElement('div');
        icon.className = 'icon';
        if (activity.iconMarkup) {
            icon.innerHTML = activity.iconMarkup;
        } else {
            const iconElement = document.createElement('i');
            iconElement.dataset.lucide = activity.icon;
            icon.appendChild(iconElement);
        }

        const title = document.createElement('h3');
        title.textContent = activity.title;
        const description = document.createElement('p');
        description.textContent = activity.description;
        card.append(icon, title, description);
        return card;
    }));
}
