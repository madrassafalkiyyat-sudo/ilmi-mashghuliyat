// Frontend configuration for the MongoDB edition of «علمی مشغولیت».
// Set ILMI_API_BASE to the deployed backend URL at deploy time
// (see DEPLOY-CHECKLIST.md step 4). It is a plain URL, not a secret.
//
// If left empty, the app falls back to its offline demo mode (the same
// fallback the old Firebase build used when Firebase failed to start),
// so committing this file unconfigured is safe — it just cannot log
// anyone in until the URL is set.
window.ILMI_API_BASE = 'https://ilmi-mashghuliyat-api.onrender.com';

// Admissions hub (Phase 1). Web app deployed 2026-10-28 under the
// institutional account (madrassa.falkiyyat@gmail.com); see admissions/DEPLOY.md.
window.ADMISSIONS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw8J8GTuGol_OqDUdO0KILtymInwJ-xWV-QSH5xuuVpFOT4E7PiJ-bo6KypGJxcVL_B/exec';
// WhatsApp help — shown ONLY at the apply stage, never on entry/info screens.
window.ADMISSIONS_WHATSAPP_NUMBER = '923219692952';
// WhatsApp group invite — shown ONLY at the apply stage, beside the number.
// Empty string hides the group button entirely (hidden-until-set).
window.ADMISSIONS_WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/EYKqTyeX0790e6cIKu6KNj?s=cl&p=a&mlu=4&ilr=4&iam=2';
