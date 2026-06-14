/**
 * Google Sheets Integration
 * 
 * Uses Google Sheets API via a service account to store duty requests.
 * The Google Apps Script Web App approach is used as a free alternative.
 * 
 * Setup:
 * 1. Create a Google Sheet
 * 2. Deploy a Google Apps Script as a Web App that accepts POST requests
 * 3. Set the EXPO_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL env variable
 */

import type { DutyType, RequestStatus } from "./firebase";

const SHEET_WEBHOOK_URL = process.env.EXPO_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL || "";

interface SheetDutyEntry {
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  dutyType: DutyType;
  status: RequestStatus;
  timestamp: string;
  requestId: string;
}

/**
 * Submit a duty request to Google Sheets via Apps Script Web App
 */
export const submitToGoogleSheet = async (entry: SheetDutyEntry): Promise<boolean> => {
  if (!SHEET_WEBHOOK_URL) {
    console.warn("Google Sheet webhook URL not configured");
    return false;
  }

  try {
    const response = await fetch(SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "addRequest",
        data: entry,
      }),
    });

    if (response.ok) {
      return true;
    }
    console.error("Failed to submit to Google Sheet:", response.status);
    return false;
  } catch (error) {
    console.error("Error submitting to Google Sheet:", error);
    return false;
  }
};

/**
 * Update status of a duty request in Google Sheets
 */
export const updateSheetStatus = async (
  requestId: string,
  status: RequestStatus
): Promise<boolean> => {
  if (!SHEET_WEBHOOK_URL) {
    console.warn("Google Sheet webhook URL not configured");
    return false;
  }

  try {
    const response = await fetch(SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateStatus",
        data: { requestId, status },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error updating Google Sheet:", error);
    return false;
  }
};
