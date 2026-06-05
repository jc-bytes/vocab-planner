import { createSupabaseFirestoreAdapter } from './supabaseFirestoreAdapter.js';
import { installSupabaseAuthProfileMethods } from './supabaseAuthProfileMethods.js';
import { installSupabaseRealtimeMethods } from './supabaseRealtimeMethods.js';
import { installSupabaseStudentWriteMethods } from './supabaseStudentWriteMethods.js';
import { installSupabaseStorageMethods } from './supabaseStorageMethods.js';

export {
    CLASSROOM_ACTIVITY_IMAGE_BUCKET,
    CLASSROOM_ACTIVITY_IMAGE_MAX_BYTES,
    CLASSROOM_SCENE_BUCKET,
    CLASSROOM_SCENE_MAX_BYTES,
    EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES,
    EXTERNAL_ARTIFACT_BUCKET,
    EXTERNAL_ARTIFACT_MAX_BYTES,
    WORD_HUNT_IMAGE_BUCKET,
    getCurrentSchoolYear,
    slugifyStoragePart
} from './supabaseServiceHelpers.js';

export const supabaseService = {
    client: null,
    currentUser: null,
    currentSession: null
};

installSupabaseAuthProfileMethods(supabaseService);
installSupabaseRealtimeMethods(supabaseService);
installSupabaseStudentWriteMethods(supabaseService);
installSupabaseStorageMethods(supabaseService);

const firestoreAdapter = createSupabaseFirestoreAdapter(supabaseService);

export const collection = firestoreAdapter.collection;
export const doc = firestoreAdapter.doc;
export const getDoc = firestoreAdapter.getDoc;
export const setDoc = firestoreAdapter.setDoc;
export const addDoc = firestoreAdapter.addDoc;
export const deleteDoc = firestoreAdapter.deleteDoc;
export const serverTimestamp = firestoreAdapter.serverTimestamp;
export const where = firestoreAdapter.where;
export const orderBy = firestoreAdapter.orderBy;
export const limit = firestoreAdapter.limit;
export const query = firestoreAdapter.query;
export const getDocs = firestoreAdapter.getDocs;
export const writeBatch = firestoreAdapter.writeBatch;
