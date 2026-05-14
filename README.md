# CineFlex API

API REST para administrar peliculas de CineFlex usando Express, Node.js y Firebase Firestore.

## Tecnologias

- Node.js
- Express
- Firebase Admin SDK
- Firestore
- Render

## Endpoints

```text
GET    /health
GET    /movies
GET    /movies/:id
POST   /movies
PUT    /movies/:id
DELETE /movies/:id
```

## Modelo Firestore

Coleccion:

```text
movies
```

Documento:

```json
{
  "title": "Interstellar",
  "genre": "Sci-Fi",
  "year": 2014,
  "available": true,
  "createdAt": "Timestamp"
}
```

## Instalacion local

Entrar a la carpeta del backend:

```powershell
cd functions
```

Instalar dependencias:

```powershell
npm install
```

Crear el archivo de credenciales:

```text
functions/serviceAccountKey.json
```

Puedes descargarlo desde:

```text
Firebase Console > Project settings > Service accounts > Generate new private key
```

Ejecutar:

```powershell
npm start
```

La API local queda disponible en:

```text
http://localhost:3000
```

Probar salud:

```text
http://localhost:3000/health
```

## Ejemplo POST /movies

```json
{
  "title": "Interstellar",
  "genre": "Sci-Fi",
  "year": 2014,
  "available": true
}
```

## Despliegue en Render

Crear un Web Service conectado al repositorio de GitHub.

Configuracion recomendada:

```text
Root Directory: functions
Build Command: npm install
Start Command: npm start
```

Render define automaticamente la variable:

```text
PORT
```

## Credenciales Firebase en Render

No subas `serviceAccountKey.json` a GitHub.

Para produccion, usa la variable de entorno:

```text
FIREBASE_SERVICE_ACCOUNT_BASE64
```

En PowerShell puedes convertir tu archivo real a Base64 asi:

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content .\serviceAccountKey.json -Raw)))
```

Luego pega ese valor en Render:

```text
Environment > Add Environment Variable
```

Nombre:

```text
FIREBASE_SERVICE_ACCOUNT_BASE64
```

Valor:

```text
PEGAR_EL_BASE64_AQUI
```

## Seguridad

El archivo real `serviceAccountKey.json` esta ignorado por Git y no debe subirse al repositorio.

Archivos seguros para subir:

- `README.md`
- `functions/index.js`
- `functions/package.json`
- `functions/package-lock.json`
- `functions/serviceAccountKey.example.json`
- `.gitignore`

Archivos que no deben subirse:

- `functions/serviceAccountKey.json`
- `.env`
- `node_modules/`
- archivos `.log`
