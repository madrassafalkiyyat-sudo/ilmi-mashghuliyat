// Frontend configuration for the MongoDB edition of «علمی مشغولیت».
// Set ILMI_API_BASE to the deployed backend URL at deploy time
// (see DEPLOY-CHECKLIST.md step 4). It is a plain URL, not a secret.
//
// If left empty, the app falls back to its offline demo mode (the same
// fallback the old Firebase build used when Firebase failed to start),
// so committing this file unconfigured is safe — it just cannot log
// anyone in until the URL is set.
window.ILMI_API_BASE = 'https://ilmi-mashghuliyat-api.onrender.com';
