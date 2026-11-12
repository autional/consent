/** WebAuthn assertion helper for the consent PWA.
 *
 * The consent service returns the identity-issued CredentialAssertion JSON
 * (base64url fields). We decode it, call navigator.credentials.get(), and
 * re-encode the assertion as the JSON proof consumed by consent.
 */
function b64uToBuf(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function bufToB64u(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface ConsentAssertionProof {
  challenge_id: string;
  assertion: {
    id: string;
    raw_id: string;
    type: string;
    response: {
      authenticator_data: string;
      client_data_json: string;
      signature: string;
      user_handle?: string;
    };
  };
}

export async function getConsentAssertion(
  challengeId: string,
  publicKeyOptions: any,
): Promise<ConsentAssertionProof> {
  const pk = publicKeyOptions?.publicKey ?? publicKeyOptions;
  if (!pk?.challenge) throw new Error('WebAuthn challenge missing');
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...pk,
      challenge: b64uToBuf(pk.challenge),
      allowCredentials: (pk.allowCredentials || []).map((c: any) => ({
        ...c,
        id: b64uToBuf(c.id),
      })),
      userVerification: pk.userVerification || 'preferred',
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('WebAuthn assertion cancelled');
  const r = credential.response as AuthenticatorAssertionResponse;
  return {
    challenge_id: challengeId,
    assertion: {
      id: credential.id,
      raw_id: bufToB64u(credential.rawId),
      type: credential.type,
      response: {
        authenticator_data: bufToB64u(r.authenticatorData),
        client_data_json: bufToB64u(r.clientDataJSON),
        signature: bufToB64u(r.signature),
        user_handle: r.userHandle ? bufToB64u(r.userHandle) : undefined,
      },
    },
  };
}
