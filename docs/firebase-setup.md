# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Name it "TUNS Duty App"
4. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication > Sign-in method**
2. Enable **Email/Password** provider
3. Go to **Authentication > Users**
4. Add users manually:
   - Email: staff hospital email
   - Password: staff number

## Step 3: Setup Firestore

1. Go to **Firestore Database > Create database**
2. Choose production mode
3. Select a region close to Hong Kong (e.g., asia-east2)

### Create Users Collection

For each staff member, create a document in the `users` collection:

```json
{
  "uid": "<firebase-auth-uid>",
  "email": "staff@hospital.com",
  "name": "CHEUNG, PAK SIU HOW",
  "staffNumber": "12345",
  "role": "user"  // or "admin"
}
```

**Important:** The document ID should be the Firebase Auth UID of the user.

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    
    // Duty requests
    match /duty_requests/{requestId} {
      // Anyone authenticated can create
      allow create: if request.auth != null;
      // Users can read their own requests
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin");
      // Users can cancel their own, admins can approve/reject
      allow update: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin");
    }
  }
}
```

## Step 4: Get Firebase Config

1. Go to **Project Settings > General**
2. Under "Your apps", click the web icon (</>)
3. Register the app
4. Copy the Firebase config object values

## Step 5: Configure Environment Variables

Set these in the app:

```
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```
