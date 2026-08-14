export class StudentActivitySession {
    constructor(activities) {
        this.activities = activities;
        this.currentVocab = null;
        this.activityInstance = null;
        this.currentActivityType = null;
        this.unitScores = {};
        this.unitImages = {};
        this.unitWordHunt = {};
        this.unitStates = {};
    }
}
