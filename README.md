# Stock Index Tracker

This application allows users to track stock indices, view historical data, manage watchlists, and set up alerts. It features a Next.js frontend and a Firebase backend using Cloud Functions and Firestore.

## Demo

https://stock-index-tracker-jjfattz.web.app/

## Prerequisites

- Node.js (v20 or later - check `backend/functions/package.json` for the specific engine version)
- npm (usually comes with Node.js)
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project
- Alpaca Markets account (for stock data API)
- SendGrid account (for email alerts)

## Firebase Setup

1.  Create a new project on the [Firebase Console](https://console.firebase.google.com/).
2.  Enable the following services for your project:
    - Authentication (Enable Email/Password sign-in method)
    - Firestore Database (Create a database, start in production mode)
    - Cloud Functions
3.  Register a Web App in your Firebase project settings to get the Firebase configuration details.
4.  Install the Firebase CLI and log in:
    ```bash
    npm install -g firebase-tools
    firebase login
    ```
5.  Associate this project directory with your Firebase project:
    ```bash
    cd backend
    firebase use --add
    ```
    Select your Firebase project when prompted.

## Environment Variable Configuration

This project requires environment variables for both the frontend and backend.

**Frontend:**

1.  Navigate to the `frontend` directory: `cd frontend`
2.  Create a `.env.local` file by copying the Firebase Web App configuration you obtained during Firebase Setup:
    ```plaintext
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
    ```
    Replace the `YOUR_*` placeholders with your actual Firebase project configuration values.

**Backend:**

1.  Navigate to the `backend/functions` directory: `cd backend/functions`
2.  Firebase Functions use runtime configuration. Set the required secrets using the Firebase CLI. Replace `<your_project_id>` with your actual Firebase project ID.

    - **Alpaca API Keys:** Get these from your Alpaca dashboard.
      ```bash
      firebase functions:secrets:set ALPACA_API_KEY --project=<your_project_id>
      firebase functions:secrets:set ALPACA_SECRET_KEY --project=<your_project_id>
      ```
      Enter the respective keys when prompted.
    - **SendGrid API Key:** Get this from your SendGrid dashboard.
      ```bash
      firebase functions:secrets:set SENDGRID_API_KEY --project=<your_project_id>
      ```
      Enter the key when prompted.
    - **SendGrid From Email:** The verified email address SendGrid will send emails from.
      ```bash
      firebase functions:secrets:set SENDGRID_FROM_EMAIL --project=<your_project_id>
      ```
      Enter the email address when prompted.

3.  Grant access to these secrets for your functions in `backend/functions/src/index.ts` if not already done by adding `runWith({ secrets: ["ALPACA_API_KEY", "ALPACA_SECRET_KEY", "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"] })` to your function definitions.

4.  For local development using emulators, create a `.env.<your_project_id>` file (e.g., `.env.stock-index-tracker-dev`) in the `backend/functions` directory with the following content:
    ```plaintext
    ALPACA_API_KEY=YOUR_ALPACA_API_KEY
    ALPACA_SECRET_KEY=YOUR_ALPACA_SECRET_KEY
    SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY
    SENDGRID_FROM_EMAIL=your_verified_sender@example.com
    ```
    Replace the placeholders with your actual keys/email. The emulators will load these variables automatically if the file matches the active Firebase project ID.

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository_url>
    cd stock-index-tracker
    ```
2.  Install backend dependencies:
    ```bash
    cd backend/functions
    npm install
    cd ../..
    ```
3.  Install frontend dependencies:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## Running Locally

1.  **Start Firebase Emulators:** Open a terminal in the `backend` directory and run:

    ```bash
    firebase emulators:start --import=./emulator-data --export-on-exit
    ```

    (The `--import` and `--export-on-exit` flags are optional for data persistence between sessions. You might need to create the `emulator-data` directory first). This will start emulators for Auth, Functions, and Firestore.

2.  **Run Backend Functions (for live compilation):** In a separate terminal, navigate to `backend/functions` and run:

    ```bash
    npm run build:watch
    ```

    This compiles TypeScript on changes. The emulators typically handle running the functions, but this ensures the code is up-to-date.

3.  **Run Frontend:** In another terminal, navigate to `frontend` and run:
    ```bash
    npm run dev
    ```
    The application should now be running at `http://localhost:3000` (or the port specified by Next.js). The frontend will automatically connect to the running Firebase emulators.

## Deployment

**Backend (Functions, Firestore Rules/Indexes):**

1.  Ensure you have set the production environment variables/secrets as described in the "Environment Variable Configuration" section.
2.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
3.  Deploy all Firebase services (Functions, Firestore rules/indexes, Hosting if configured):
    ```bash
    firebase deploy
    ```
    This command reads the `firebase.json` file and deploys the services defined within it. Ensure your `firebase.json` is correctly configured for all the services you intend to deploy. The functions will be built automatically as part of the deployment process if specified in `firebase.json`.
