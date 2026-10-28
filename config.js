// Frontend configuration for the MongoDB edition of «علمی مشغولیت».
// Set ILMI_API_BASE to the deployed backend URL at deploy time
// (see DEPLOY-CHECKLIST.md step 4). It is a plain URL, not a secret.
//
// If left empty, the app falls back to its offline demo mode (the same
// fallback the old Firebase build used when Firebase failed to start),
// so committing this file unconfigured is safe — it just cannot log
// anyone in until the URL is set.
window.ILMI_API_BASE = 'https://ilmi-mashghuliyat-api.onrender.com';

// Admissions hub (Phase 1). The script URL stays empty until the Apps
// Script web app is deployed (see admissions/DEPLOY.md); until then the
// forms show an honest "not yet active" notice instead of fake submissions.
window.ADMISSIONS_SCRIPT_URL = '';
// WhatsApp help — shown ONLY at the apply stage, never on entry/info screens.
window.ADMISSIONS_WHATSAPP_NUMBER = '923219692952';
// WhatsApp group invite — shown ONLY at the apply stage, beside the number.
// Empty string hides the group button entirely (hidden-until-set).
window.ADMISSIONS_WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/EYKqTyeX0790e6cIKu6KNj?s=cl&p=a&mlu=4&ilr=4&iam=2';
