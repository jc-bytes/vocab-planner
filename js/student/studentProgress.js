/**
 * Student Progress & Coin Management Module
 * Handles progress saving/loading (local & cloud) and coin operations
 */

import { installStudentProgressCloudMethods } from './studentProgressCloudMethods.js';
import { installStudentProgressCoinMethods } from './studentProgressCoinMethods.js';
import { installStudentProgressCoreMethods } from './studentProgressCoreMethods.js';

export class StudentProgress {
    constructor(studentManager) {
        this.sm = studentManager;
        this.coinRealtimeUnsubscribe = null;
        this.coinSyncInterval = null;
        this.storageSyncHandler = null;
        this.focusSyncHandler = null;
        this.visibilitySyncHandler = null;
        this.onlineSyncHandler = null;
        this.clientId = sessionStorage.getItem('student_coin_client_id') ||
            (crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        sessionStorage.setItem('student_coin_client_id', this.clientId);
    }
}

installStudentProgressCoreMethods(StudentProgress);
installStudentProgressCloudMethods(StudentProgress);
installStudentProgressCoinMethods(StudentProgress);
