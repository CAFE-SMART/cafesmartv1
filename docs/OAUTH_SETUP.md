# OAuth Setup para Cafe Smart

## Variables de entorno

| Archivo | Uso | Variables |
|---------|-----|-----------|
| `frontend/.env` | Web local | `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` |
| `frontend/.env.android` | Android build | `VITE_API_URL` |
| `frontend/.env.example` | Plantilla | Referencia |

`VITE_GOOGLE_CLIENT_ID` es publico y debe coincidir con el Web Client ID configurado en Google Cloud. No pongas Client Secret en el frontend.

Client ID web actual del proyecto:

```text
141554793359-p5od3hodjn7he16pi555voh0chivpu93.apps.googleusercontent.com
```

## Google Cloud Console - Web Client ID

Agregar solo origenes, sin rutas, a "Origenes autorizados de JavaScript":

| Origen | Plataforma |
|--------|------------|
| `http://localhost:5173` | Desarrollo Vite |
| `http://localhost:4173` | Preview local Vite |
| `http://127.0.0.1:5173` | Desarrollo local alterno |
| `https://cafesmart.netlify.app` | Produccion web |

Si el dominio real de produccion es diferente a `https://cafesmart.netlify.app`, agrega ese origen real tambien y elimina el que no se use.

No agregues rutas como `/login`, `/register` o `/crear-empresa`. Google valida el origin completo: protocolo, host y puerto.

NO agregar `10.0.2.2`: esa IP es solo para API/backend en el emulador Android.

## Android Client ID

Para Android nativo se usa SHA-1, package name y redirect URI; no se configuran JavaScript Origins.

## Backend URLs por plataforma

| Plataforma | `VITE_API_URL` |
|------------|----------------|
| Web local | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Dispositivo fisico | `http://192.168.X.X:3000` |
| Produccion | Backend HTTPS real en Render |

## Notas de implementacion

- La app monta un solo `GoogleOAuthProvider` en `frontend/src/main.tsx`.
- `Login` usa redireccion OAuth directa.
- `Register` usa `GoogleLogin` de `@react-oauth/google` y no llama manualmente a `google.accounts.id.initialize`.