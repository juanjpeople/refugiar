/**
 * El celular de un chico entra sin email ni contraseña: firma un desafío del servidor con su llave
 * del dispositivo (ECDSA P-256, no exportable). Esto es lo que firma; lo usan la app y el servidor.
 */
export const deviceSignInData = (userId: string, challenge: string) => `refugiar/device-sign-in|${userId}|${challenge}`;

/** Lo que dura un código para vincular un celular (el adulto lo muestra y el chico lo escanea en el momento). */
export const DEVICE_LINK_MINUTES = 15;
