import { installSupabaseAuthProfileMethods } from './supabaseAuthProfileMethods.js';
import { installSupabaseStudentWriteMethods } from './supabaseStudentWriteMethods.js';
import { installSupabaseStorageMethods } from './supabaseStorageMethods.js';

export {
    WORD_HUNT_IMAGE_BUCKET,
    getCurrentSchoolYear,
    slugifyStoragePart
} from './services/supabaseValues.js';

export const supabaseService = {
    client: null,
    currentUser: null,
    currentSession: null,
    initPromise: null,
    initialized: false
};

installSupabaseAuthProfileMethods(supabaseService);
installSupabaseStudentWriteMethods(supabaseService);
installSupabaseStorageMethods(supabaseService);
