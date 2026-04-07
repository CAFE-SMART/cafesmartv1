import { normalizePossiblyMojibake, parseJwtPayload } from './jwt';

export type GoogleJwtPayload = {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export type GoogleNameParts = {
  nombre: string;
  apellidos: string;
};

export type GooglePrefill = {
  correo: string;
  nombre: string;
  apellidos: string;
};

export function splitGoogleName(payload: GoogleJwtPayload): GoogleNameParts {
  const given = normalizePossiblyMojibake(payload.given_name).trim();
  const family = normalizePossiblyMojibake(payload.family_name).trim();

  if (given || family) {
    return {
      nombre: given,
      apellidos: family,
    };
  }

  const fullName = normalizePossiblyMojibake(payload.name).trim();
  if (!fullName) {
    return { nombre: '', apellidos: '' };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { nombre: parts[0], apellidos: '' };
  }

  return {
    nombre: parts[0],
    apellidos: parts.slice(1).join(' '),
  };
}

export function decodeGoogleJwt(idToken: string): GoogleJwtPayload {
  const payload = parseJwtPayload<GoogleJwtPayload>(idToken) ?? {};

  return {
    ...payload,
    email: normalizePossiblyMojibake(payload.email),
    name: normalizePossiblyMojibake(payload.name),
    given_name: normalizePossiblyMojibake(payload.given_name),
    family_name: normalizePossiblyMojibake(payload.family_name),
  };
}

export function getGooglePrefillFromIdToken(idToken: string): GooglePrefill {
  const googleData = decodeGoogleJwt(idToken);
  const nameParts = splitGoogleName(googleData);

  return {
    correo: googleData.email || '',
    nombre: nameParts.nombre,
    apellidos: nameParts.apellidos,
  };
}
