-- Cuánto ocupa cada foto cifrada de una casa. El almacenamiento de fotos no lo dice sin listar todo,
-- y su capa gratuita es una sola para todas las casas: con esto el Worker frena a una casa que llega
-- a su tope (server/src/quotas.ts) antes de que llene el lugar de las demás. Las fotos subidas antes
-- de esta tabla no cuentan. Al borrar la casa, sus filas se van en cascada.
create table photo_objects (
  household_id text not null references households ("id") on delete cascade,
  photo_id text not null,
  variant text not null check (variant in ('full', 'thumb')),
  bytes integer not null,
  created_at integer not null,
  primary key (household_id, photo_id, variant)
);
