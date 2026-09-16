-- Remove o valor ATENDENTE do enum "Role" (apenas ADMINISTRADOR e SOLICITANTE).
-- Equivalente à migração aplicada no banco remoto via MCP (remove_attendant_role).
-- O Postgres não suporta dropar valor de enum diretamente; recria-se o tipo.

create type "Role_new" as enum ('SOLICITANTE', 'ADMINISTRADOR');

alter table "User" alter column "role" drop default;
alter table "ActivationCode" alter column "role" drop default;

alter table "User" alter column "role" type "Role_new" using ("role"::text::"Role_new");
alter table "ActivationCode" alter column "role" type "Role_new" using ("role"::text::"Role_new");

alter table "User" alter column "role" set default 'SOLICITANTE'::"Role_new";
alter table "ActivationCode" alter column "role" set default 'SOLICITANTE'::"Role_new";

drop type "Role";
alter type "Role_new" rename to "Role";
