const admin = require('firebase-admin');

function normalizePrivateKey(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const unwrapped = raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1)
    : raw;

  return unwrapped.replace(/\\n/g, '\n');
}

function getFirebaseConfig() {
  return {
    projectId: String(process.env.FIREBASE_PROJECT_ID || '').trim(),
    clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || '').trim(),
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
  };
}

function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const { projectId, clientEmail, privateKey } = getFirebaseConfig();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin env vars are not fully configured');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

function getFirestore() {
  return getFirebaseApp().firestore();
}

module.exports = {
  getFirestore
};
