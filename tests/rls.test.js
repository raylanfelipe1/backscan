// PostgreSQL local em memória. Auth/Storage usam tabelas mínimas de teste.
// Não simula o serviço HTTP Supabase, login, upload de bytes nem URLs assinadas.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("RLS do schema real isola proprietários e exige autorização", async (t) => {
  const pg = await PGlite.create();
  t.after(() => pg.close());
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public, storage to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text, unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await pg.exec(await readFile(new URL("../sql/schema.sql", import.meta.url), "utf8"));
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const c = "33333333-3333-4333-8333-333333333333";
  const ia = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ib = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const f = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const path = `${a}/${ia}/${f}`;
  await pg.query("insert into auth.users values ($1),($2),($3)", [a,b,c]);
  await pg.query("insert into public.authorized_users(user_id) values ($1),($2)", [a,b]);
  const actor = async (id, role = "authenticated") => {
    await pg.exec("reset role");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
    await pg.exec(`set role ${role}`);
  };
  const incident = (id, owner) => pg.query(`insert into public.incidents
    (id,owner_id,contact,channel,title,details) values ($1,$2,'fixture','teste','teste','teste')`, [id,owner]);
  const upload = (name, bucket = "backscan-evidence") => pg.query(
    "insert into storage.objects(bucket_id,name) values ($1,$2)", [bucket,name]);
  const evidence = (owner = a, inc = ia, file = path, hash = "a".repeat(64)) => pg.query(`
    insert into public.evidence(owner_id,incident_id,file_path,file_name,sha256)
    values ($1,$2,$3,'fixture.txt',$4)`, [owner,inc,file,hash]);
  const denied = (fn) => assert.rejects(fn, /row-level security|permission denied|check constraint|foreign key/i);

  await t.test("autorizados criam incidentes e só veem os próprios", async () => {
    await actor(a); await incident(ia,a);
    await actor(b); await incident(ib,b);
    assert.deepEqual((await pg.query("select id from public.incidents")).rows, [{ id: ib }]);
    await denied(() => incident(crypto.randomUUID(),a));
    assert.equal((await pg.query("update public.incidents set title='invadido' where id=$1 returning id", [ia])).rows.length, 0);
    assert.equal((await pg.query("delete from public.incidents where id=$1 returning id", [ia])).rows.length, 0);
  });
  await t.test("usuário não autorizado não entra nem se autoautoriza", async () => {
    await actor(c);
    assert.equal((await pg.query("select * from public.incidents")).rows.length, 0);
    await denied(() => incident(crypto.randomUUID(),c));
    await denied(() => pg.query("insert into public.authorized_users(user_id) values ($1)", [c]));
    await denied(() => upload(`${c}/${ia}/${f}`));
  });
  await t.test("anônimo não lê registros nem envia arquivos", async () => {
    await actor(null, "anon");
    await denied(() => pg.query("select * from public.incidents"));
    await denied(() => pg.query("select * from public.evidence"));
    await denied(() => pg.query("select * from public.authorized_users"));
    await denied(() => upload(path));
    assert.equal((await pg.query("select * from storage.objects")).rows.length, 0);
  });
  await t.test("arquivo e metadado devem pertencer ao mesmo incidente e proprietário", async () => {
    await actor(a);
    await denied(() => evidence()); // arquivo inexistente
    await denied(() => upload(`${a}/${ib}/${f}`));
    await denied(() => upload(`${b}/${ia}/${f}`));
    await denied(() => upload(`${a}/${ia}/arquivo/extra`));
    await denied(() => upload(path, "outro-bucket"));
    await upload(path);
    await denied(() => evidence(a, ib));
    await denied(() => evidence(b, ia));
    await denied(() => evidence(a, ia, path, "inválido"));
    await evidence();
    assert.equal((await pg.query("select * from public.evidence")).rows.length, 1);
    await denied(() => pg.query("update public.evidence set sha256=$1", ["b".repeat(64)]));
    assert.equal((await pg.query("update storage.objects set name='substituído' returning id")).rows.length, 0);
    await denied(() => pg.query("update public.incidents set owner_id=$1 where id=$2", [b,ia]));
  });
  await t.test("outra conta não lê nem exclui arquivos e metadados", async () => {
    await actor(b);
    assert.equal((await pg.query("select * from public.evidence")).rows.length, 0);
    assert.equal((await pg.query("select * from storage.objects")).rows.length, 0);
    assert.equal((await pg.query("delete from storage.objects returning id")).rows.length, 0);
    assert.equal((await pg.query("delete from public.evidence returning id")).rows.length, 0);
  });
  await t.test("revogação bloqueia novos acessos mesmo com o mesmo UID", async () => {
    await pg.exec("reset role");
    await pg.query("delete from public.authorized_users where user_id=$1", [a]);
    await actor(a);
    assert.equal((await pg.query("select * from public.incidents")).rows.length, 0);
    assert.equal((await pg.query("select * from public.evidence")).rows.length, 0);
    assert.equal((await pg.query("select * from storage.objects")).rows.length, 0);
    await denied(() => upload(`${a}/${ia}/${crypto.randomUUID()}`));
    await pg.exec("reset role");
    await pg.query("insert into public.authorized_users(user_id) values ($1)", [a]);
    await actor(a);
    assert.equal((await pg.query("select * from storage.objects")).rows.length, 1);
    await pg.exec("delete from public.evidence; delete from storage.objects;");
  });
  await t.test("bucket privado fixa tamanho e tipos permitidos", async () => {
    await pg.exec("reset role");
    const { rows: [bucket] } = await pg.query("select * from storage.buckets");
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 10485760);
    assert.deepEqual(bucket.allowed_mime_types, ["image/png","image/jpeg","image/webp","application/pdf","text/plain"]);
  });
});
