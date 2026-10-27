import { bindFloatingActionMenu } from './ui/floatingActionMenu.js';
import { createElement } from './main.js';

// Faces and action policies belong to the caller; this module owns their shared frame.
export function createTeacherMaterialItem({ face, title, onPreview, onEdit, onAssign, onDelete, onReviewLocalCopy, contextLabel }) {
    const wrapper = createElement('article', 'teacher-material-item');
    wrapper.append(face);
    if (contextLabel) wrapper.append(createElement('small', 'teacher-material-context', contextLabel));
    const actions = createElement('div', 'teacher-material-actions');
    const menu = createElement('div');
    const button = (text, className, handler) => {
        const node = createElement('button', `btn secondary-btn ${className}`, text);
        node.type = 'button';
        node.setAttribute('role', 'menuitem');
        node.addEventListener('click', handler);
        menu.append(node);
    };
    button('Student preview', 'preview-vocab-btn', onPreview);
    button('Edit', 'edit-vocab-btn', onEdit);
    if (onReviewLocalCopy) button('Review local copy', 'review-local-copy-btn', onReviewLocalCopy);
    if (onAssign) button('Assign', 'assign-vocab-btn', onAssign);
    if (onDelete) button('Delete', 'delete-vocab-btn', onDelete);
    const trigger = createElement('button', 'btn secondary-btn');
    trigger.setAttribute('aria-label', `More actions for ${title}`);
    menu.setAttribute('aria-label', `Actions for ${title}`);
    actions.append(trigger, menu);
    bindFloatingActionMenu({ trigger, menu });
    wrapper.append(actions);
    return wrapper;
}
