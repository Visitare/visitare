# ADR 0002 — Modelo de identidade & autenticação (extensível para SSO da prefeitura)

- **Status:** aceito
- **Data:** 2026-06-28
- **Contexto:** reunião SMS-Rio (piloto Rocinha). Pedidos: regras de login, consumo via datalake, hosting, LGPD, escopos delimitados, integração futura com o modelo de identidade da prefeitura.

## Princípio

> **Separar autenticação (quem emite a identidade) de autorização (quais claims liberam acesso).**

O app e a RLS dependem apenas dos **claims** do JWT — nunca do emissor. Trocar "login do piloto" por "SSO da prefeitura" é **adicionar uma conexão de IdP**, não reescrever.

## Decisão

**Supabase Auth como *broker* de identidade**, com claims customizados vindos de uma tabela `profissionais`. Três estágios sem mudar o app:

1. **Piloto (fase 1):** login real via Supabase Auth (e-mail/senha ou magic link). Cada ACS da Rocinha na `profissionais`. RLS ligada, keyed nos claims.
2. **Federação:** Supabase Auth faz SSO **SAML 2.0** e **third-party OIDC** — gov.br/ConecteSUS é OIDC (caminho provável). As mesmas policies valem.
3. **IdP próprio (Keycloak gov):** Supabase valida o JWT externo via custom JWT secret. Continua claim-based.

## Claims (contrato estável)

O **Custom Access Token Hook** injeta no JWT, a partir de `profissionais` (via `auth_user_id`):

| Claim | Origem | Usado por |
|---|---|---|
| `acs_id` | `profissionais.acs_id` (= `visitas.profissional_id` / `allocations.acs_id`) | RLS ACS, filtro da lista da semana |
| `clinica_id` | `profissionais.clinica_id` (= `equipe_id`) | RLS gestor de clínica |
| `role` | `profissionais.role` | RBAC |

Nomes alinhados às policies da migration 006 — ligar a RLS é só aplicar 006 §RLS (sem reescrever policy).

## Tabela `profissionais`

Âncora de identidade **CNS** (padrão SUS), com `cpf`/`matricula` opcionais até a prefeitura confirmar. `acs_id`/`clinica_id` são os ids **operacionais** que casam com os dados existentes.

```
id uuid PK | auth_user_id uuid (→ auth.users) | acs_id text | clinica_id text
cns text? | cpf text? | matricula text?  (identidade — uma delas vira a âncora do SSO)
nome text | microarea text? | role text (acs|gestor_clinica|gestor_municipal|admin)
ativo bool | created_at | updated_at
```

## RBAC

Papéis definidos já (fase 1 usa só `acs`): `acs`, `gestor_clinica`, `gestor_municipal`, `admin`. "Escopos delimitados" = scopes no token / policies por papel.

## Segurança & LGPD

- **Minimização:** engine opera em IDs pseudonimizados; a chave de reidentificação fica **no datalake da prefeitura**, não no nosso Supabase.
- **Datalake:** camada `DataSource` (a fazer) desacopla a origem dos dados → trocar Supabase ↔ datalake sem tocar scoring/alocação. Atende "consumir do datalake, não do prontuário".
- **Residência/hosting:** dado no Brasil → Supabase região São Paulo; infra deles → engine é container FastAPI stateless, portável.
- **Token:** access token curto + refresh; **MFA** para gestor/admin; `service_role`/secret só server-side.
- **Auditoria (LGPD art. 37):** log de leitura/escrita de dado de paciente (quem/quando/o quê).
- **RLS ON em produção** — a postura demo (007, RLS off) é temporária.

## Consequências / sequência

1. Migration 009: `profissionais` + Custom Access Token Hook + grants. (não liga RLS de allocations ainda)
2. Login Supabase Auth + religar PWA ao claim `acs_id` (substitui mock e o RPC antigo).
3. Migration 010: ligar RLS de allocations (reaplica 006 §RLS) — depois do login E2E.
4. Futuro: conexão OIDC/SAML da prefeitura; camada `DataSource` para datalake; auditoria.
