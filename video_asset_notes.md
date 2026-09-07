# Admin tutorial video asset notes

- IMG_6941.PNG: portrait Request Duty home screen, showing Ward 8S, TUNS Request duty, request slots, Submit, Review Requested duty, Review Approved duty, Log out, and Admin approve duty. The screenshot appears to be an older UI version and should be used only as a visual reference, not as the sole source for current button behavior.
- IMG_6942.PNG: portrait pending-approval screen showing a pending duty row and navigation to Review Approved duty and Review Rejected duty. The screenshot also appears older and should be used as a reference only.
- Current implementation source is the authoritative source for current Admin workflows: app/(tabs)/admin-approve.tsx, app/(tabs)/approved-duty.tsx, app/(tabs)/index.tsx, and app/(tabs)/settings.tsx.
- User requirements for video: Cantonese narration, Traditional Chinese subtitles, use current app screens/interface.

- IMG_6943.PNG: older requested-duty rejected view; useful only as a general status-list visual reference.
- IMG_6944.PNG: older Approved Duty list and calendar view with multiple staff and dates; useful as a general reference for the Approved Duty scene, but not authoritative for current controls.

- IMG_9602.PNG and IMG_9603.PNG: newer current-version Approved Duty screens, portrait mobile layout with month navigation, All staff filter, duty legend, calendar dots, staff initials/color avatars, approved-duty list, and bottom tabs Request / My Requests / Approved / Admin / Settings. These are suitable as current interface references for the Approved Duty and navigation scenes.
