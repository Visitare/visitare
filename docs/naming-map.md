# Naming map — Secretaria (PT) ⇄ Visitare (EN)

Os dados vêm do modelo da SMS-Rio (português). Internamente o Visitare usa
inglês; a camada `DataSource` (ADR 0002) mapeia na fronteira com o datalake.
Siglas e termos SUS sem tradução limpa são **mantidos**: `acs`, `icsap`,
`cns`, `cpf`, `microarea`.

## Tabelas

| SMS-Rio (PT) | Visitare (EN) |
|---|---|
| pacientes | patients |
| visitas | visits |
| visitas_capturadas | captured_visits |
| eventos | events |
| equipes | teams |
| profissionais | professionals |

## Colunas

| PT | EN |
|---|---|
| paciente_id | patient_id |
| equipe_id / clinica_id / clinic_id | team_id |
| profissional_id | professional_id |
| unidade_id | unit_id |
| faixa_etaria | age_band |
| sexo | sex |
| raca_cor | race_color |
| situacao_vulnerabilidade | social_vulnerability |
| hipertenso / diabetico / gestacao | hypertensive / diabetic / pregnant |
| endereco_latitude / endereco_longitude | latitude / longitude |
| registrados_em | recorded_at |
| capturado_em | captured_at |
| data_referencia | reference_date |
| ordem_visita_dia | daily_visit_order |
| perfil_blocos | profile_blocks |
| sincronizado_vitacare / sincronizado_em | synced_vitacare / synced_at |
| tipo | type |
| motivo | reason |
| nome | name |
| ativo | active |
| matricula | registration |
| cadencia_oficial | official_cadence |
| linha_de_cuidado | care_line |

## Valores

| PT | EN |
|---|---|
| tier: alto / medio / habitual | high / medium / routine |
| origin: gestor | manager |
| role: gestor_clinica / gestor_municipal | clinic_manager / city_manager |

## Fichas (formulários SMS-Rio) — de/para

| Código SMS-Rio | Visitare |
|---|---|
| ficha_a_cadastro_familia | form_a_family_registration |
| ficha_b_cronico | form_b_chronic |
| ficha_b_gestante | form_b_pregnant |
| ficha_b_tuberculose | form_b_tuberculosis |
| ficha_c_primeira_infancia | form_c_early_childhood |

## RPCs / views

| PT | EN |
|---|---|
| priorizacao_pacientes | prioritized_patients |
| dashboard_equipe | team_dashboard |
| paciente_detalhe | patient_detail |
| equipe_do_profissional | professional_team |
| pacientes_ficha_extendida | patients_extended_record |
| acs_demo_options | _(mantém; obsoleto após login)_ |
