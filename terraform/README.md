# Playbook: Firebase + Terraform + GitHub Actions (dev/prod), reutilizable

Instructivo paso a paso para desplegar una app Firebase (Hosting + Auth +
Firestore) con Terraform y CI/CD 100% gratis en GitHub Actions, con
ambientes **dev** y **prod** separados y aislados. Escrito para poder
copiarse a otro proyecto cambiando solo nombres — la parte reutilizable
está en `modules/`.

## Arquitectura

```
terraform/
  modules/
    bootstrap/       # Genérico: Workload Identity Federation (atado a
                      # repo + rama), service account de CI, bucket de
                      # state. Nada específico de esta app.
    firebase-app/     # Genérico: Firebase project, web app, Firestore,
                      # reglas, sitio de Hosting. Recibe la ruta al
                      # archivo de reglas como variable.
  envs/
    dev/
      bootstrap/       # Wrapper delgado → modules/bootstrap
                        # (project_id=<algo>-dev, branch=develop)
      app/             # Wrapper delgado → modules/firebase-app
    prod/
      bootstrap/        # Wrapper delgado → modules/bootstrap
                         # (project_id=<algo>, branch=main)
      app/               # Wrapper delgado → modules/firebase-app
  firestore.rules   # Única fuente de verdad de las reglas, compartida
                    # por dev y prod.
```

**Por qué dos proyectos GCP separados (no uno solo con dos bases de
datos):** aislamiento real — IAM, cuotas, facturación y blast radius
completamente separados. Si algo sale mal en dev, es físicamente imposible
que toque prod: son proyectos distintos, con identidades de CI distintas,
cada una restringida a su propia rama de GitHub.

**Regla de oro que evita el bug que nos mordió la primera vez:** la base de
datos Firestore la crea **siempre Terraform** (`google_firestore_database`
en `modules/firebase-app`), nunca la consola de Firebase. Si la creas a
mano desde el asistente de la consola, quedan publicadas las reglas por
defecto (`allow read, write: if false`) y Terraform nunca las reemplaza
correctamente — Terraform y la consola quedan desincronizados y el error es
muy confuso de diagnosticar (parece un problema de permisos o de UID,
cuando en realidad las reglas correctas nunca se publicaron).

## Prerrequisitos

- `gcloud` autenticado con una cuenta que sea Owner/Editor de tu
  organización o facturación: `gcloud auth application-default login`.
- `terraform` >= 1.9 instalado localmente (para correr el bootstrap; el
  resto lo corre CI).
- Un repo en GitHub (puede estar vacío al empezar).

## Paso 1 — Crear los proyectos (vacíos, sin Firestore/Auth todavía)

Para cada ambiente, en [Firebase Console](https://console.firebase.google.com/):

1. "Agregar proyecto" → nombre (`<algo>-dev` / `<algo>`) → plan Spark.
2. **No entres al asistente de Firestore ni de Authentication.** Cierra la
   consola ahí — Terraform se encarga desde el siguiente paso.

## Paso 2 — Bootstrap de cada ambiente (una sola vez, a mano)

Repite esto **dos veces**, una por carpeta:

```bash
cd terraform/envs/dev/bootstrap      # o envs/prod/bootstrap
cp terraform.tfvars.example terraform.tfvars
# edita terraform.tfvars: github_owner, github_repo
terraform init
terraform apply
```

⚠️ Si te pide vincular una cuenta de facturación para habilitar
Storage/IAM, es esperado (fuera del paquete "Firebase Spark") — el costo
real es $0 (bucket de state pesa KB), pero confírmalo tú mismo antes de
aceptar.

Guarda los outputs de cada uno (los vas a necesitar en el paso 4):
```bash
terraform output workload_identity_provider
terraform output service_account_email
```

## Paso 3 — Ramas de Git

```bash
git checkout -b develop
git push -u origin develop
```

`develop` despliega a dev automáticamente. `main` despliega a prod, con
aprobación manual.

## Paso 4 — Configurar GitHub (Environments con scope)

En **Settings → Environments**, crea dos:

- **`development`**: sin reglas de protección (auto-deploy).
- **`production`**: con **"Required reviewers"** (tú mismo) — el
  `terraform apply` y el deploy de prod quedan pausados hasta que los
  apruebes en la pestaña Actions.

Dentro de **cada** environment, agrega sus propias **Variables** y
**Secrets** (mismos nombres en los dos, GitHub resuelve el valor correcto
según el `environment:` que declare cada job — así el YAML no necesita
sufijos `_DEV`/`_PROD`):

- **Variables**: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
  `GCP_SERVICE_ACCOUNT_EMAIL` (del bootstrap correspondiente).
- **Secrets**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID` — estos los sacas en el paso 5, después del primer
  apply (hay una dependencia circular menor: el primer push puede fallar en
  el job de build por falta de secrets, es normal, se corrige agregándolos
  y volviendo a correr el workflow).

## Paso 5 — Primer apply de cada ambiente (vía CI)

```bash
git add terraform/ .github/
git commit -m "Infra: Terraform + GitHub Actions para dev/prod"
git push origin develop     # dispara deploy-dev.yml (auto-apply)
```

Cuando esté listo, mergea `develop` a `main` (PR o merge directo) y push —
dispara `deploy-prod.yml`, pausado en el environment `production` hasta que
lo apruebes en **Actions**.

Para sacar la config web de cada ambiente después del apply:
```bash
cd terraform/envs/dev/app   # o envs/prod/app
terraform init -backend-config="bucket=<project-id>-tfstate" -backend-config="prefix=app"
terraform output -json firebase_web_app_config
```
Copia esos 6 valores a los Secrets del environment correspondiente en
GitHub (paso 4) y vuelve a correr el workflow (Actions → Re-run jobs) para
que el build de Hosting quede con la config correcta.

## Paso 6 — Activar Authentication (manual, en cada proyecto)

En **cada** proyecto (dev y prod): Firebase Console → **Authentication →
Sign-in method → Email/Password**. Queda fuera de Terraform a propósito —
el recurso de Terraform para proveedores de sign-in vive bajo Identity
Platform, un superset de pago con otro modelo de precios; no vale la pena
migrar el proyecto a eso solo por automatizar este toggle.

## Paso 7 — Poblar datos (por separado en cada ambiente)

**Nunca sincronices datos automáticamente entre dev y prod** — son
ambientes con propósitos distintos (pruebas vs. datos reales de la
familia). Corre el script de migración una vez por proyecto, con la
service account de cada uno:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/serviceAccountKey-dev.json \
FIREBASE_PROJECT_ID=<algo>-dev \
node scripts/migrate-to-firebase.mjs

GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/serviceAccountKey-prod.json \
FIREBASE_PROJECT_ID=<algo> \
node scripts/migrate-to-firebase.mjs
```

Si alguna vez necesitas depurar con una copia real de los datos de prod en
dev (con cuidado, son datos financieros), usa `gcloud firestore export` /
`import` contra un bucket de Cloud Storage — es un paso manual y puntual,
no una tubería automática.

## Flujo de trabajo día a día

1. Trabajas en una rama de feature → PR contra `develop` → el workflow
   `terraform-plan.yml` comenta el plan de **ambos** ambientes (dev y prod)
   si tocaste algo en `terraform/`.
2. Merge a `develop` → deploy automático a dev → pruebas ahí.
3. Cuando estés conforme, PR de `develop` a `main` → merge → `deploy-prod`
   se dispara pero queda pausado hasta que apruebes en Actions.

## Reutilizar esto en otro proyecto

1. Copia la carpeta `terraform/modules/` completa — no tiene nada
   específico de esta app.
2. Escribe tu propio `terraform/envs/dev/` y `terraform/envs/prod/`
   (copia los wrappers de este proyecto y cambia `project_id`,
   `app_display_name`).
3. Escribe tu propio `terraform/firestore.rules` para las reglas de tu
   nueva app.
4. Copia los 3 workflows de `.github/workflows/` y ajusta los `paths:` si
   tu estructura de carpetas difiere.
5. Repite los pasos 1–7 de este documento.
