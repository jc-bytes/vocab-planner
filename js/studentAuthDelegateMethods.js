class StudentAuthDelegateMethods {
    updateHeader() {
        return this.auth.updateHeader();
    }

    checkProfile(force = false) {
        return this.auth.checkProfile(force);
    }

    async initBackendAuth() {
        return this.auth.initBackendAuth();
    }

    async fetchAndSetRole(user) {
        return this.auth.fetchAndSetRole(user);
    }

    async handleBackendSignIn(user) {
        return this.auth.handleBackendSignIn(user);
    }

    handleBackendSignOut() {
        return this.auth.handleBackendSignOut();
    }
}

export function installStudentAuthDelegateMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentAuthDelegateMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentAuthDelegateMethods.prototype, name)
        );
    }
}
