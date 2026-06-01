class StudentActivityDelegateMethods {
    async loadManifest() {
        return this.activities.loadManifest();
    }

    renderDashboard() {
        return this.activities.renderDashboard();
    }

    async loadVocabulary(vocabMeta, options = {}) {
        return this.activities.loadVocabulary(vocabMeta, options);
    }

    showActivityMenu(options = {}) {
        return this.activities.showActivityMenu(options);
    }

    async loadCloudVocabularies() {
        return this.activities.loadCloudVocabularies();
    }

    startActivity(type, options = {}) {
        return this.activities.startActivity(type, options);
    }
}

export function installStudentActivityDelegateMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentActivityDelegateMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityDelegateMethods.prototype, name)
        );
    }
}
