# Maqamat Tracker — public pages

These three pages contain NO student data. They load live from the Google Sheet through the Apps Script API (admin page) and the public tracker API (student / executive pages), so they open directly in any browser, including inside WhatsApp.

- admin.html — Admin view (Mufti + Hasib). Email gate in the page.
- student.html — a student enters their email or phone and sees ONLY their own record.
- executive.html — summary numbers only; the executive email is checked server-side.

Do NOT commit any file containing student names, phone numbers or payments to this repo. The admin page intentionally has no embedded snapshot.
