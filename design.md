# TUNS Duty Request App — Interface Design

## Overview

This is a mobile app for hospital staff ranked "TUNS" to request duty shifts. The app has two user roles: **Admin** and **Ordinary User**. Both login with hospital email + staff number. The app is designed for **mobile portrait orientation (9:16)** and **one-handed usage**, following Apple Human Interface Guidelines.

---

## Screen List

| Screen | Role | Description |
|--------|------|-------------|
| Login | All | Email + staff number login |
| TUNS Request Duty (Home) | All | Main screen to submit duty requests |
| Your Requested Duty | All | View pending requests, swipe to cancel, view rejected |
| Review Approved Duty | All | View approved duties with calendar |
| Admin Approve Duty | Admin | Review and approve/reject pending requests |

---

## Color Choices

| Element | Color | Hex |
|---------|-------|-----|
| Primary (Submit button) | Green | #4CAF50 |
| Review Requested Duty button | Pink | #E91E8B |
| Review Approved Duty button | Blue/Indigo | #3F51B5 |
| Admin Approve Duty button | Orange/Amber | #FF9800 |
| Log Out button | Red | #F44336 |
| Cancel/Reject indicator | Red | #EF4444 |
| Approved indicator | Green | #22C55E |
| Pending indicator | Amber | #F59E0B |
| Background | White | #FFFFFF |
| Text Primary | Dark | #11181C |
| Text Secondary/Muted | Grey | #687076 |

---

## Screen Details

### 1. Login Screen

**Content:**
- App title: "Ward 8S" (bold, large)
- Subtitle: "TUNS Request Duty"
- Email input field (hospital email)
- Password input field (staff number)
- Login button (green, full-width)

**Layout:**
- Centered vertically
- Logo/title at top
- Form fields in middle
- Login button at bottom of form

---

### 2. TUNS Request Duty (Home Screen)

**Content:**
- Header: "Ward 8S" (bold) + "TUNS Request duty" subtitle
- Today's date display (format: DD/M/YYYY)
- Staff name display
- Request rows (Request 1, Request 2) each containing:
  - Date picker (only dates from today+7 days to today+7days+8weeks)
  - Duty selector (options: A, P, 0900-1700, 0900-1300)
  - Reset button (pink circle)
- Submit button (large, green, rounded)
- Navigation buttons row:
  - "Review Requested duty" (pink)
  - "Review Approved duty" (blue/indigo)
- Bottom row:
  - "Log out" (red)
  - "Admin approve duty" (orange, only visible to admin)

**Layout:**
- Scrollable content
- Title section at top
- Request form in center
- Action buttons at bottom

---

### 3. Your Requested Duty (Pending)

**Content:**
- Title: "Your requested duty pending approval"
- List of pending duty requests, each showing:
  - Staff avatar (grey circle placeholder)
  - Staff name
  - Date (DD/M/YYYY format)
  - Duty type (A, P, 0900-1700, 0900-1300)
- Swipe left to reveal cancel action
- Bottom buttons:
  - "Review Approved duty" (indigo)
  - "Review Rejected duty" (teal/green)

**Interaction:**
- Swipe left on any item → reveals "Cancel" button
- Tap "Cancel" → marks request status as "cancelled"
- Tap "Review Rejected duty" → opens modal with rejected requests

---

### 4. Rejected Duty Modal

**Content:**
- Title: "—— Rejected duty ——" (red text with dashes)
- List of rejected duties showing:
  - Staff avatar
  - Staff name
  - Date
  - Duty type
- Close button or tap outside to dismiss

---

### 5. Review Approved Duty

**Content:**
- Title: "Approved duty" (bold)
- List of approved duties showing:
  - Staff avatar
  - Staff name
  - Date (DD/M/YYYY)
  - Duty type
- Calendar view below the list (month view)
  - Shows current month
  - Highlights today
  - Shows indicators on dates with approved duties
  - Navigation arrows for month switching

---

### 6. Admin Approve Duty (Admin Only)

**Content:**
- Title: "Requests pending approval"
- Staff info section:
  - Selected Staff Name
  - Total working hours this week (Sun-Sat)
- Calendar view (month view, same style as Approved Duty)
- List of pending requests showing:
  - Staff avatar
  - Staff name
  - Date
  - Duty type
- Bottom buttons:
  - "Request duty" (green) — approve selected
  - "Review Approved duty" (indigo) — navigate to approved view

---

## Key User Flows

### Flow 1: Submit Duty Request
1. User logs in with email + staff number
2. Lands on "TUNS Request Duty" home screen
3. Selects date for Request 1 (date picker, restricted range)
4. Selects duty type (A/P/0900-1700/0900-1300)
5. Optionally fills Request 2
6. Taps "Submit" button
7. Data saved to Google Sheets + Firestore with status "pending"
8. Success confirmation shown

### Flow 2: Cancel a Request
1. User navigates to "Your Requested Duty"
2. Sees list of pending requests
3. Swipes left on a request
4. Taps "Cancel" action
5. Request status updated to "cancelled" in database (not deleted)

### Flow 3: View Rejected Duties
1. From "Your Requested Duty" screen
2. Taps "Review Rejected duty" button
3. Modal appears with list of rejected duties
4. User reviews and dismisses modal

### Flow 4: Admin Approves/Rejects
1. Admin navigates to "Admin approve duty"
2. Sees calendar + list of pending requests
3. Selects a request
4. Approves or rejects
5. Status updated in database

---

## Typography

| Element | Size | Weight |
|---------|------|--------|
| Screen title | 24-28px | Bold |
| Subtitle | 18-20px | Regular |
| Body text | 16px | Regular |
| List item name | 16px | Bold |
| List item date | 14px | Regular, muted |
| Button text | 16px | Semibold |

---

## Component Patterns

- **Cards/List Items**: White background, subtle border, rounded corners (12px)
- **Buttons**: Full-width or half-width, rounded (24px radius), bold text
- **Avatars**: 40px grey circle placeholder
- **Date Picker**: Native date picker restricted to valid range
- **Duty Selector**: Dropdown/picker with 4 options
- **Swipe Actions**: Red background with "Cancel" text on swipe left
- **Modals**: Bottom sheet or center modal with list content
