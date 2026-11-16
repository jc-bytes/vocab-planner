import { mountFoundationModule } from './shared/foundation-module.js';
import { lesson } from './lesson.js';
import { validateLesson } from './validate.js';
validateLesson(lesson);
document.title = lesson.title;
mountFoundationModule(lesson);
