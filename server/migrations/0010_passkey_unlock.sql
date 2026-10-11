-- Entrar sin contraseña con una llave de acceso (huella, cara o PIN del dispositivo). La llave da
-- un secreto (extensión PRF de WebAuthn) que nunca sale del dispositivo; con él se cifra una copia
-- de las claves privadas, que se guarda acá. El servidor no la puede abrir. Borrar la llave borra
-- su copia. Tabla del plugin de Refugiar en Better Auth (ver server/src/two-factor.ts).
create table "passkeyUnlock" ("id" text not null primary key, "passkeyId" text not null unique references "passkey" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "privateKeys" text not null, "createdAt" date not null);

create index "passkeyUnlock_userId_idx" on "passkeyUnlock" ("userId");
