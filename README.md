# WealthGuide — Gestor de Patrimonio Familiar (React)

Dashboard financiero familiar en React (Vite + Tailwind + Chart.js), conectado
a **Firebase Authentication y Cloud Firestore reales** — no hay mock ni
`localStorage`: cada cuenta, propiedad, vehículo, programa de lealtad,
transacción e histórico de patrimonio neto se lee/escribe en vivo desde
Firestore (`onSnapshot`), compartido entre todos los dispositivos de la
familia. Este documento cubre cómo correr el proyecto localmente y, en la
segunda mitad, **cómo se desplegó a producción, incluyendo la migración de
todos los datos**.

## Instalación

```bash
npm install
cp .env.example .env   # completa con las credenciales de tu proyecto Firebase
npm run dev
```

Abre `http://localhost:5173`. Necesitas un proyecto Firebase real con
**Authentication > Email/Password** y **Firestore** habilitados (ver
"Despliegue en producción" más abajo) — sin eso, `login()`/`register()`
fallan porque no hay mock al que recurrir. El registro queda abierto, pero
una cuenta nueva no ve ningún dato hasta que el administrador la apruebe
desde la consola de Firebase (`Firestore Database > users/{uid} > approved:
true`) — ver la sección 3 de despliegue para el detalle.

## Estructura del proyecto

```
local-data/                  # Datos semilla (fuente de verdad para los defaults)
  cuentas.csv                 # Categoria, Nombre_Cuenta, Monto_Objetivo, Incluir, Ultimo_Valor
  propiedades.csv             # Propiedad, Valor_Avaluo, Fecha_Avaluo
  vehiculos.json               # id, nombre, valor_original, anio_compra
  puntos.json                  # categorias[]: id, nombre, equivalencia_dolar, grupo, color
  networth_db.csv              # Fecha, Ahorro, Inversion, Jubilacion, Deuda, Prestamo (histórico mensual)

scripts/
  migrate-to-firebase.mjs      # Migra local-data/* a Firestore (ver sección de despliegue)

src/
  firebase/config.js           # Inicialización de Firebase (usa .env)
  context/
    AuthContext.jsx             # Provee el estado de auth (user, approved) a toda la app
    AccountsContext.jsx         # Cuentas (activos/pasivos) — colección Firestore `accounts`
    PropertiesContext.jsx       # Propiedades — colección Firestore `properties`
    VehiclesContext.jsx         # Vehículos — colección Firestore `vehicles`
    LoyaltyContext.jsx          # Programas de lealtad — colección Firestore `loyaltyPrograms`
    NetworthHistoryContext.jsx  # Histórico — colección Firestore `networthHistory` (hidden:true = "eliminado")
  data/networthHistory.js      # Helpers de formato/filtrado por rango (formatHistoryLabel, filterHistoryByRange)
  hooks/
    useAuth.js                   # login / register / logout + estado `approved` (Firebase Auth + Firestore)
    useTransactions.js           # transacciones de Efectivo Diario — colección Firestore `transactions`
  components/
    layout/Sidebar.jsx, TopBar.jsx, AppLayout.jsx
    ChartCanvas.jsx              # wrapper de Chart.js
    ProtectedRoute.jsx           # redirige a /login si no hay sesión, o muestra "pendiente de aprobación"
  pages/
    Login.jsx                    # tabs Iniciar Sesión / Crear Cuenta
    Resumen.jsx                  # KPIs + gráficos históricos de patrimonio neto
    PatrimonioNeto.jsx           # edición de saldos de cuentas + propiedades + vehículos
    EfectivoDiario.jsx           # flujo mensual + alta/baja de transacciones
    Presupuesto.jsx              # presupuesto vs gasto real (derivado de transacciones)
    Prestamos.jsx                # préstamos/hipotecas activos (cuentas categoría "prestamos")
    Lealtad.jsx                  # puntos y millas, balance editable en pantalla
    Jubilacion.jsx                # simulador de jubilación
    Simuladores.jsx              # interés compuesto + avalancha de deuda
    Configuracion.jsx            # perfil, cuentas, propiedades, vehículos, programas de lealtad, usuarios
```

### Dónde vive cada dato (Firestore, colecciones compartidas)

| Dato | Context/hook | Colección Firestore |
|---|---|---|
| Perfil / estado de aprobación | `useAuth.js` | `users/{uid}` (`approved`, `email`, `fullName`) |
| Cuentas (activos/pasivos) | `AccountsContext` | `accounts` |
| Propiedades | `PropertiesContext` | `properties` |
| Vehículos | `VehiclesContext` | `vehicles` |
| Programas de lealtad | `LoyaltyContext` | `loyaltyPrograms` |
| Histórico de patrimonio neto | `NetworthHistoryContext` | `networthHistory` (`hidden: true` = "eliminado") |
| Transacciones (Efectivo Diario / Presupuesto) | `useTransactions.js` | `transactions` |

Todas son colecciones compartidas (sin `uid` de por medio): cualquier cuenta
aprobada ve y edita los mismos datos, en tiempo real, en cualquier
dispositivo — ver `terraform/firestore.rules` para las reglas exactas.

---

## Despliegue en producción con Firebase (incluye migración de todos los datos)

Esta sección cubre el camino completo: qué servicios de Firebase se necesitan,
cuánto cuestan, cómo migrar los datos actuales (`local-data/*` + lo que ya
hayas editado en tu navegador) a Firestore, y cómo publicar la app.
**Ningún paso de esta sección se ha ejecutado — es la propuesta para tu
aprobación antes de crear o modificar cualquier recurso de facturación real.**

> La infraestructura (Firestore + reglas + sitio de Hosting) ahora vive como
> código en `terraform/`, con **dev y prod separados**, y se aplica vía
> GitHub Actions — ver
> [CI/CD con GitHub Actions, dev + prod](#cicd-con-github-actions-dev--prod-gratis)
> más abajo, y el instructivo completo en
> [`terraform/README.md`](terraform/README.md). Las secciones 2–4 de aquí
> abajo describen el "qué" y el "por qué"; el "cómo se ejecuta" quedó
> automatizado.

### 1. Servicios necesarios y costo estimado

| Servicio | Para qué se usa | Plan | Costo esperado |
|---|---|---|---|
| **Firebase Hosting** | Servir el build de Vite (`dist/`) | Spark (gratis) | **$0/mes** — el build de esta app pesa ~500 KB; el plan gratis incluye 10 GB de almacenamiento y 360 MB/día de transferencia, muy por encima de lo que un dashboard familiar de pocos usuarios consume. |
| **Firebase Authentication** | Login/registro por email y contraseña | Spark (gratis) | **$0/mes** — Email/Password no tiene costo en ningún volumen; no se necesita el plan Blaze solo por esto. |
| **Cloud Firestore** | Cuentas, propiedades, vehículos, lealtad, histórico, transacciones | Spark (gratis) hasta agotar cuota; Blaze (pago por uso) si se excede | **$0/mes en uso normal.** Cuota gratis diaria: 50,000 lecturas, 20,000 escrituras, 20,000 eliminaciones, 1 GiB de almacenamiento total. Con 1–5 usuarios familiares revisando el dashboard varias veces al día, esto no debería agotarse. Si se excede (plan Blaze): ≈ $0.06 por 100,000 lecturas, ≈ $0.18 por 100,000 escrituras, ≈ $0.18/GiB/mes de almacenamiento — verificar cifras vigentes en la consola de Firebase antes de aprobar, los precios pueden cambiar. |
| Cloud Functions | No se usa — toda la lógica corre en el cliente (React + SDK de Firestore) | — | $0 (no se habilita) |
| Cloud Storage | No se usa — no hay subida de archivos/imágenes en esta app | — | $0 (no se habilita) |

**Conclusión de costo**: con el uso esperado (una familia, pocos dispositivos),
la app completa debería operar en **$0/mes** dentro del plan Spark. El único
motivo para pasar a Blaze sería exceder la cuota gratis de Firestore (uso
mucho más intenso de lo esperado) o querer más funcionalidades de Hosting con
más tráfico — ninguno de los dos aplica hoy. Aun así, Blaze requiere una
tarjeta de facturación asociada al proyecto (aunque el consumo real sea $0);
si prefieres evitarlo por completo, Firestore en Spark ya es suficiente para
operar la app tal como está. Esta tabla aplica **por proyecto** — como hay
dos (dev y prod), en la práctica son dos proyectos en Spark a $0/mes cada
uno, no un costo duplicado real.

### 2. Crear los proyectos de Firebase (dev y prod)

Se crean **dos** proyectos vacíos (`networth-algam-dev` y `networth-algam`)
desde [Firebase Console](https://console.firebase.google.com/) → "Agregar
proyecto" — y ahí se para: **no** se habilita Firestore ni se registra la
app web a mano. Todo eso (Firestore, reglas, la app web y sus credenciales)
lo crea Terraform, para que nunca queden desincronizados con lo que
gestiona el código — ver el paso a paso completo en
[`terraform/README.md`](terraform/README.md). Authentication > Email/Password
sí se activa a mano, en cada proyecto (ver la sección de CI/CD más abajo).
Las credenciales para tu `.env` local salen del output de Terraform
(`firebase_web_app_config`), no de copiarlas manualmente de la consola.

### 3. Reglas de seguridad de Firestore

Este es un dashboard **familiar compartido, no un SaaS multi-tenant**: toda
cuenta *aprobada* ve y edita la misma información — no hay aislamiento por
`uid` en los datos del dashboard. Pero el registro (`register()`) queda
**abierto** (cualquiera con el link puede crear una cuenta), así que se
agrega un paso de **aprobación manual**: un usuario recién registrado no
puede leer/escribir ningún dato hasta que tú lo apruebes desde la consola.

```
// Firestore Rules — ver terraform/firestore.rules para la versión completa
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isApproved() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;
    }

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId
        && request.resource.data.approved == false;   // nunca se auto-aprueba
      allow update, delete: if false;                   // solo el admin, desde la consola
    }

    match /accounts/{document=**}        { allow read, write: if isApproved(); }
    match /properties/{document=**}      { allow read, write: if isApproved(); }
    match /vehicles/{document=**}        { allow read, write: if isApproved(); }
    match /loyaltyPrograms/{document=**} { allow read, write: if isApproved(); }
    match /networthHistory/{document=**} { allow read, write: if isApproved(); }
    match /transactions/{document=**}    { allow read, write: if isApproved(); }
  }
}
```

Cómo funciona la aprobación en la práctica:

1. Alguien se registra → la app crea su cuenta en Firebase Auth **y** un
   documento `users/{uid}` con `{ approved: false, email, fullName }`
   (implementado en `useAuth.js`, función `register`).
2. Mientras `approved` sea `false`, las reglas de arriba le niegan leer o
   escribir cualquier colección del dashboard (`accounts`, `properties`,
   etc.) — solo puede leer su propio doc en `users/{uid}` para saber que
   sigue pendiente.
3. Tú entras a **Firebase Console > Firestore Database > Datos >
   `users/{uid}`** y cambias `approved` a `true` a mano. La consola opera
   con permisos de administrador (IAM), así que esto funciona aunque las
   reglas le nieguen ese mismo cambio al propio usuario — es intencional:
   nadie puede auto-aprobarse, ni siquiera editando el cliente.
4. La próxima vez que esa cuenta abra la app (o si ya tenía un listener
   activo), ya ve todos los datos compartidos.

Publícalas desde la consola (Firestore Database > Reglas) o con
`firebase deploy --only firestore:rules` si usas Firebase CLI. (Si usas el
flujo de Terraform de más abajo, esto ya lo gestiona
`terraform/firestore.rules` automáticamente.)

### 4. Contexts conectados a Firestore (ya implementado)

`AccountsContext`, `PropertiesContext`, `VehiclesContext`, `LoyaltyContext` y
`NetworthHistoryContext` ya no usan `localStorage` — cada uno escucha su
colección compartida con `onSnapshot` (gateado por `approved`, del
`AuthContext`) y escribe con `addDoc`/`updateDoc`/`deleteDoc` directo a
Firestore, sin cambiar la interfaz pública que ya consumían las páginas
(`accounts`, `addAccount`, `updateAccount`, etc.). `useTransactions.js` sigue
el mismo patrón sobre la colección `transactions`. Resultado: cualquier
edición se guarda sola y se refleja en tiempo real en todos los dispositivos
de la familia — no hace falta ningún paso manual de por medio.

### 5. Migrar los datos existentes (`local-data/*` + lo que ya cargaste en el navegador)

Hay dos fuentes de datos a considerar:

- **Los datos semilla** (`local-data/cuentas.csv`, `propiedades.csv`,
  `vehiculos.json`, `puntos.json`, `networth_db.csv`): usa el script incluido
  `scripts/migrate-to-firebase.mjs` para cargarlos directamente a Firestore,
  en colecciones compartidas (no hay `uid` de por medio — toda la familia
  ve los mismos datos).

  ```bash
  npm install --no-save firebase-admin
  # Firebase Console > Project Settings > Service Accounts > Generate new private key
  # Guarda el archivo FUERA de este repo — nunca lo subas a git.
  GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/serviceAccountKey.json \
  FIREBASE_PROJECT_ID=tu-proyecto-id \
  node scripts/migrate-to-firebase.mjs
  ```

  Este script es idempotente (usa IDs de documento determinísticos), así que
  correrlo de nuevo sobreescribe en vez de duplicar.

- **Lo que ya editaste manualmente en tu navegador** (saldos actualizados en
  Patrimonio Neto, balances de puntos en Lealtad, cuentas agregadas en
  Configuración, filas eliminadas del histórico, etc.), que hoy vive solo en
  el `localStorage` de tu navegador y **no está en `local-data/`**. Si quieres
  conservarlo:
  1. Abre la consola del navegador en la app corriendo y exporta cada clave:
     `copy(localStorage.getItem('wealthguide_accounts'))` (y así con
     `wealthguide_properties`, `wealthguide_vehicles`, `wealthguide_loyalty`,
     `wealthguide_networth_history_deleted_dates`).
  2. Pega cada resultado en un archivo JSON temporal.
  3. Ajusta el script de migración (o corre uno puntual) para leer esos JSON
     en vez de `local-data/*` para ese usuario.

  Dime si quieres que prepare ese script de exportación/import puntual — no
  lo incluí por defecto porque requeriría acceso a tu navegador real para
  extraer los datos, y preferí no asumir cuáles ediciones quieres conservar.

⚠️ **Nota sobre `useTransactions.js`**: hoy no persiste nada (vive solo en
memoria), así que no hay datos de Efectivo Diario/Presupuesto que migrar —
arrancará vacío en Firestore hasta que conectes ese hook (paso 4 más arriba).

### 6. Publicar con Firebase Hosting

Esto lo hace GitHub Actions, no a mano — ver
[CI/CD con GitHub Actions](#cicd-con-github-actions-dev--prod-gratis) más
abajo. `firebase.json` ya está configurado (`public: "dist"`, rewrite SPA a
`index.html`); el workflow de deploy corre `npm run build` +
`firebase deploy --only hosting` usando la misma identidad OIDC de
Terraform, sin `firebase login` ni llaves de larga duración.

### 7. Checklist antes de aprobar el paso a producción

- [x] Reglas de seguridad de Firestore publicadas (solo cuentas con
      `approved == true` leen/escriben los datos del dashboard; registro
      abierto pero sin acceso hasta la aprobación manual).
- [x] `register()` en `useAuth.js` crea el doc `users/{uid}` con
      `approved: false`, y `ProtectedRoute` muestra "pendiente de
      aprobación" mientras tanto.
- [x] Contexts (`AccountsContext`, `PropertiesContext`, `VehiclesContext`,
      `LoyaltyContext`, `NetworthHistoryContext`) y `useTransactions.js`
      conectados a Firestore en tiempo real.
- [ ] Probado el flujo completo una vez: registrar una cuenta nueva,
      confirmar que no ve datos, aprobarla desde la consola, confirmar que
      ya los ve.
- [ ] `.env` de producción con las credenciales del proyecto de Firebase real
      (no las de un proyecto de pruebas).
- [ ] Migración de `local-data/*` corrida (`scripts/migrate-to-firebase.mjs`)
      hacia las colecciones compartidas.
- [ ] Decisión tomada sobre si conservar las ediciones manuales guardadas
      hoy en `localStorage` (ver paso 5).
- [ ] Confirmado que el plan de Firebase queda en Spark (gratis) o, si se
      necesita Blaze, que el costo esperado (ver tabla de costos) fue
      aprobado.

## CI/CD con GitHub Actions, dev + prod (gratis)

Todo el pipeline corre en GitHub Actions (2,000 min/mes gratis en repos
privados, ilimitado en públicos) usando **Workload Identity Federation**
(OIDC) para autenticarse contra GCP — sin llaves de service account de
larga duración guardadas como secreto. Hay **dos proyectos Firebase
completamente separados** (`networth-algam-dev` y `networth-algam`), cada
uno con su propia identidad de CI restringida a su propia rama de Git
(`develop` → dev, `main` → prod) — un error en dev no puede tocar prod
aunque quisiera, son proyectos distintos.

El instructivo paso a paso completo (bootstrap de cada ambiente,
configuración de GitHub, primer apply, cómo poblar datos, y cómo reutilizar
esta misma estructura en otro proyecto) vive en
**[`terraform/README.md`](terraform/README.md)** — es el documento vivo,
esta sección es solo el resumen.

### Estructura

```
terraform/
  modules/            # Reutilizable — sin nada específico de esta app.
    bootstrap/          # WIF pool+provider (repo+rama), SA de CI, bucket
                         # de state.
    firebase-app/        # Firebase project, web app, Firestore, reglas,
                          # sitio de Hosting.
  envs/
    dev/{bootstrap,app}/   # Wrappers delgados → project_id=networth-algam-dev
    prod/{bootstrap,app}/  # Wrappers delgados → project_id=networth-algam
  firestore.rules      # Única fuente de verdad, compartida por ambos.

.github/workflows/
  terraform-plan.yml   # PR que toca terraform/** → plan de dev Y prod,
                        # comentados en el PR.
  deploy-dev.yml         # push a `develop` → apply automático (sin
                          # aprobador) → build + firebase deploy a dev.
  deploy-prod.yml         # push a `main` → apply pausado en el
                           # environment `production` hasta que lo
                           # apruebes → build + firebase deploy a prod.
```

### Regla de oro (evita el bug que ya nos mordió una vez)

La base de datos Firestore la crea **siempre Terraform**
(`google_firestore_database` en `modules/firebase-app`) — nunca la consola.
Crearla a mano desde el asistente deja publicadas las reglas por defecto
(`allow read, write: if false`) y Terraform nunca las reemplaza
correctamente, así que Terraform y la consola quedan desincronizados. Por
eso el Paso 1 del playbook dice explícitamente: crea el proyecto vacío y
**no entres** al asistente de Firestore/Authentication.

### Por qué no todo vía Terraform

- **Contenido de Hosting**: Terraform gestiona el `site`, no el build. Subir
  `dist/` sigue siendo trabajo de `firebase deploy`, que es lo que hace el
  job `deploy-hosting` de cada workflow.
- **Auth Email/Password**: el recurso de Terraform para proveedores de
  sign-in vive bajo Identity Platform, un superset de pago de Firebase Auth
  con precios distintos — se deja manual (en cada proyecto) para no migrar
  el proyecto sin querer.

## Notas de diseño

Los tokens de color, tipografía y espaciado de Tailwind (`tailwind.config.js`)
se extrajeron directamente de la configuración `tailwind.config` embebida en
cada mockup HTML usado como referencia de diseño, para mantener la identidad
visual original.
