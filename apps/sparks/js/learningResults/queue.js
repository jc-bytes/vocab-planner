import {LearningCoordinator} from './coordinator.js';
import {learningAssetsReady} from './runtimeAssets.js';
import {getActiveStudentStorageOwner} from '../student/persistence/studentStorage.js';
export function ensureLearningQueue(queue) {
    const sm=queue.sm;
    const owner=()=>sm.currentUser?.uid && sm.currentUser.uid===getActiveStudentStorageOwner()?sm.currentUser.uid:null;
    if(!sm.learningResults)sm.learningResults={coordinator:new LearningCoordinator({owner,prepareAssets:learningAssetsReady}),queue:null,unregister:null};
    const state=sm.learningResults;
    if(state.queue!==queue){state.unregister?.();state.unregister=state.coordinator.register(queue);state.queue=queue;}
    return state.coordinator;
}
