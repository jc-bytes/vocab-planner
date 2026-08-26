import { getActiveStudentStorageOwner } from '../student/persistence/studentStorage.js';
import { illustrationEntryStateMethods } from './illustration/illustrationEntryStateMethods.js';
import { illustrationImageMethods } from './illustration/illustrationImageMethods.js';
import { illustrationInputMethods } from './illustration/illustrationInputMethods.js';
import { illustrationLifecycleMethods } from './illustration/illustrationLifecycleMethods.js';
import { illustrationViewMethods } from './illustration/illustrationViewMethods.js';

const illustrationMethodGroups = [
    illustrationEntryStateMethods,
    illustrationLifecycleMethods,
    illustrationViewMethods,
    illustrationInputMethods,
    illustrationImageMethods
];

export class IllustrationActivity {
    constructor(container, words, vocabName, onProgress, onWordHuntSave, initialData = null, options = {}) {
        this.container = container;
        this.words = words;
        this.vocabName = vocabName;
        this.onProgress = onProgress;
        this.onWordHuntSave = onWordHuntSave;
        this.onWordChange = typeof options.onWordChange === 'function' ? options.onWordChange : null;
        this.uploadImage = typeof options.uploadImage === 'function' ? options.uploadImage : null;
        this.loadRemoteImage = typeof options.loadImage === 'function' ? options.loadImage : null;
        this.onDownloadWordHunt = typeof options.onDownloadWordHunt === 'function' ? options.onDownloadWordHunt : null;
        this.researchContext = options.researchContext && typeof options.researchContext === 'object'
            ? options.researchContext
            : {};
        this.allowTextPaste = options.allowTextPaste !== false;
        this.ownerUserId = options.ownerUserId || getActiveStudentStorageOwner();
        this.currentIndex = this.clampIndex(options.initialIndex || 0);
        this.entries = this.mergeEntries(initialData);
        this.previewImage = null;
        this.previewUrl = null;
        this.pasteHandler = null;
        this.writingCheckerCleanup = null;

        this.init();
    }
}

illustrationMethodGroups.forEach(methods => {
    Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
        Object.defineProperty(IllustrationActivity.prototype, name, {
            ...descriptor,
            enumerable: false
        });
    });
});
