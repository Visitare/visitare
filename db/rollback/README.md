# db/rollback

Scripts de desfazimento das migrations que ficam em `supabase/migrations/`.

O Supabase CLI não tem conceito de *down migration*: tudo que está em
`supabase/migrations/` é executado, em ordem de timestamp, por
`supabase db push` e `supabase db reset`. Um arquivo `*_down.sql` naquele
diretório seria aplicado como se fosse mais uma migration — ou seja,
desfaria a migration anterior em produção.

Por isso os scripts de rollback vivem aqui, fora do caminho do CLI. Nada
neste diretório roda automaticamente. Para desfazer uma migration, aplique o
arquivo correspondente à mão:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/rollback/014_lockdown_rls_down.sql
```

O nome do arquivo repete o prefixo numérico da migration que ele desfaz.
