// Verifies a Google Sign-In ID token (the JWT credential the frontend gets
// back from Google Identity Services) and extracts the account's verified
// identity from it.
//
// This never touches a password — the whole point of "Sign in with Google"
// is that Google authenticates the person on its own domain, and all our
// server does is confirm the token Google handed back is genuine and meant
// for this app (matches GOOGLE_CLIENT_ID), then reads the claims out of it.
//
// Requires GOOGLE_CLIENT_ID in .env — create one at
// https://console.cloud.google.com/apis/credentials ("OAuth client ID",
// application type "Web application"). No client secret is needed for this
// token-verification flow.

import { OAuth2Client } from "google-auth-library";

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google sign-in isn't configured on this server yet.");
  }
  return new OAuth2Client(clientId);
}

/**
 * @param {string} credential - the ID token JWT from Google Identity Services
 * @returns {Promise<{ googleId: string, email: string, name: string }>}
 */
export async function verifyGoogleCredential(credential) {
  if (!credential) {
    throw new Error("Missing Google credential.");
  }

  const client = getClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    throw new Error("Couldn't verify that Google sign-in — please try again.");
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Google didn't return an email for that account.");
  }
  // Google's own flag for whether the email on the account has been
  // verified — should always be true for a normal Google account, but
  // worth checking rather than assuming.
  if (!payload.email_verified) {
    throw new Error("That Google account's email isn't verified.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || "",
  };
}