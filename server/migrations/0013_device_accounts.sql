-- El celular de un chico, sin email ni contraseña. Un adulto lo vincula a su perfil con un código de
-- un solo uso (una invitación `device`). El celular crea sus claves y una llave de firma P-256 que no
-- se puede exportar: entra firmando un desafío con ella. Acá va solo la parte pública de esa llave.
-- Tabla del plugin de Refugiar en Better Auth (ver server/src/device-auth.ts).
create table "deviceKey" ("id" text not null primary key, "userId" text not null unique references "user" ("id") on delete cascade, "publicKey" text not null, "createdAt" date not null, "lastUsedAt" date);

-- `device`: el código para vincular el celular de un chico (rol chico, vence en minutos).
alter table invites add column kind text not null default 'account' check (kind in ('account', 'device'));
