# Resumen de ejecucion del proyecto CineFlex Firebase

Este documento resume lo realizado para ejecutar el proyecto localmente con Firebase Emulators.

## Proyecto detectado

El proyecto es una API REST construida con:

- Firebase Cloud Functions
- Express
- Firebase Admin SDK
- Cloud Firestore
- Firebase Emulator Suite

Archivos principales:

- `firebase.json`
- `functions/package.json`
- `functions/index.js`

La funcion HTTP exportada se llama `api`:

```js
exports.api = functions.https.onRequest(app);
```

## Comando para ejecutar

Desde PowerShell, ubicarse en la raiz del proyecto:

```powershell
cd C:\Users\sebas\OneDrive\Documentos\taller_firebase
```

Ejecutar los emuladores:

```powershell
npx firebase-tools emulators:start --only functions,firestore --project demo-cineflex
```

Se usa `npx firebase-tools` porque el comando global `firebase` no estaba instalado.

## URLs importantes

Endpoint de salud de la API:

```text
http://127.0.0.1:5001/demo-cineflex/us-central1/api/api/health
```

Interfaz web de Firebase Emulator UI:

```text
http://127.0.0.1:4000
```

Si el puerto `4000` esta ocupado, Firebase puede mover la UI automaticamente a otro puerto, por ejemplo:

```text
http://127.0.0.1:4001
```

## Problema 1: comando firebase no reconocido

Al verificar Firebase CLI aparecio:

```text
firebase : El termino 'firebase' no se reconoce...
```

Solucion usada:

```powershell
npx firebase-tools --version
```

Esto descarga y ejecuta Firebase CLI temporalmente sin instalarlo globalmente.

## Problema 2: puerto 8080 ocupado

Al iniciar los emuladores, Firestore fallo porque el puerto `8080` estaba ocupado:

```text
Error: Could not start Firestore Emulator, port taken.
```

Se reviso que el puerto `8080` estaba siendo usado por un proceso `java`.

Solucion aplicada:

Se modifico `firebase.json` para mover Firestore del puerto `8080` al `8081`.

Antes:

```json
"firestore": {
  "port": 8080
}
```

Despues:

```json
"firestore": {
  "port": 8081
}
```

## Problema 3: puerto 8081 tambien ocupado

Despues, el puerto `8081` tambien aparecio ocupado. Se detectaron procesos antiguos de Firebase Emulator que quedaron corriendo:

- `node.exe` usando puertos como `4000`, `4400`, `4500`, `5001`
- `java.exe` usando `8081`

Se cerraron los procesos anteriores que bloqueaban los puertos.

Recomendacion:

Cuando se quiera apagar el proyecto, usar `Ctrl + C` en la terminal donde corre Firebase. Asi se evita que queden procesos ocupando puertos.

## Problema 4: error con Timestamp

Al probar `/api/health`, aparecio este error:

```text
TypeError: Cannot read properties of undefined (reading 'now')
```

La causa fue que el codigo usaba:

```js
admin.firestore.Timestamp.now()
```

Con la version instalada de `firebase-admin`, `Timestamp` debe importarse desde `firebase-admin/firestore`.

Solucion aplicada en `functions/index.js`:

```js
const { Timestamp } = require("firebase-admin/firestore");
```

Y se cambiaron las funciones auxiliares:

```js
function nowTimestamp() {
  return Timestamp.now();
}

function minutesFromNow(minutes) {
  return Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);
}
```

## Archivos modificados

Se modificaron estos archivos:

- `firebase.json`
- `functions/index.js`

Se creo este documento:

- `RESUMEN_EJECUCION.md`

## Verificacion realizada

Se valido que `functions/index.js` carga correctamente con Node:

```powershell
node -e "require('./functions/index.js'); console.log('functions loaded')"
```

Resultado:

```text
functions loaded
```

## Nota sobre version de Node

El proyecto declara Node 20 en `functions/package.json`:

```json
"engines": {
  "node": "20"
}
```

En la maquina se detecto Node:

```text
v24.15.0
```

Si Firebase Functions muestra errores de compatibilidad, se recomienda instalar y usar Node 20 para este proyecto.

