# CineFlex Microservices

## Descripcion tecnica del problema y objetivo

CineFlex necesita administrar funciones de cine, reservas de asientos, pagos, snacks y notificaciones mediante servicios RESTful integrables. El problema principal es que una simulacion o mock server no garantiza persistencia real, control de concurrencia ni trazabilidad transaccional para operaciones sensibles como reservar un asiento o aprobar un pago.

El objetivo de esta solucion es implementar una API escalable en Firebase Cloud Functions con Express.js, persistiendo datos en Cloud Firestore. La arquitectura separa responsabilidades por recurso: cartelera, reservas, pagos, snacks y notificaciones. Firestore permite almacenar el estado operacional del sistema, validar conflictos de asientos y ejecutar transacciones atomicas para evitar reservas duplicadas.

## Modelo de datos en Firestore

### `movies`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `title` | string | Nombre de la pelicula. |
| `genre` | string | Genero principal. |
| `durationMinutes` | number | Duracion en minutos. |
| `classification` | string | Clasificacion de edad. |
| `synopsis` | string | Resumen de la pelicula. |
| `posterUrl` | string | URL del poster. |
| `showtimes` | array<object> | Funciones disponibles. Cada objeto incluye `id`, `room`, `startsAt`, `basePrice`. |
| `createdAt` | timestamp | Fecha de creacion. |
| `updatedAt` | timestamp | Ultima actualizacion. |

### `reservations`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `movieId` | string | ID del documento en `movies`. |
| `showtimeId` | string | ID de la funcion dentro de la pelicula. |
| `seat` | string | Asiento reservado, por ejemplo `A1`. |
| `customerName` | string | Nombre del cliente. |
| `customerEmail` | string | Correo del cliente. |
| `totalAmount` | number | Valor requerido para confirmar la reserva. |
| `status` | string | `reserved`, `paid`, `cancelled` o `expired`. |
| `createdAt` | timestamp | Fecha de creacion. |
| `updatedAt` | timestamp | Ultima actualizacion. |
| `expiresAt` | timestamp | TTL logico de 10 minutos para reservas no pagadas. |
| `paidAt` | timestamp | Fecha de pago, si aplica. |

### `payments`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `reservationId` | string | ID de la reserva asociada. |
| `amount` | number | Monto enviado por el cliente. |
| `requiredAmount` | number | Monto requerido por la reserva. |
| `method` | string | Metodo de pago: `card`, `transfer`, `cash`, etc. |
| `transactionReference` | string | Referencia externa de transaccion. |
| `status` | string | `approved`, `rejected` o `refunded`. |
| `reason` | string | Motivo de rechazo, si aplica. |
| `createdAt` | timestamp | Fecha de creacion. |
| `updatedAt` | timestamp | Ultima actualizacion. |
| `refundedAt` | timestamp | Fecha de reversion, si aplica. |

### `snacks`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `reservationId` | string | ID de la reserva asociada. |
| `items` | array<object> | Productos solicitados. Cada objeto incluye `sku`, `name`, `quantity`, `unitPrice`. |
| `totalAmount` | number | Total del pedido. |
| `status` | string | `ordered`, `delivered` o `cancelled`. |
| `createdAt` | timestamp | Fecha de creacion. |
| `updatedAt` | timestamp | Ultima actualizacion. |

### `notifications`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `reservationId` | string | ID de la reserva asociada. |
| `type` | string | Canal o tipo: `email`, `sms`, `push`. |
| `recipient` | string | Destinatario. |
| `message` | string | Mensaje enviado. |
| `status` | string | `sent`, `failed` o `pending`. |
| `createdAt` | timestamp | Fecha de creacion. |
| `updatedAt` | timestamp | Ultima actualizacion. |

## Tabla de endpoints

| Metodo | URL | Body JSON | Respuesta exitosa | Respuesta de error |
| --- | --- | --- | --- | --- |
| GET | `/api/movies` | No aplica | `200` con `{ "data": [...] }` | `500` ante error interno. |
| POST | `/api/reservations` | `movieId`, `showtimeId`, `seat`, `customerName`, `customerEmail`, `totalAmount` | `201` con reserva en estado `reserved` y `expiresAt` a 10 min. | `404` si no existe la pelicula. `409` si el asiento ya esta reservado o pagado. |
| PUT | `/api/reservations/:id` | Campos editables de reserva | `200` con reserva actualizada | `404` si no existe. `409` si el nuevo asiento entra en conflicto. |
| DELETE | `/api/reservations/:id` | No aplica | `200` con estado `deleted` y pagos revertidos | `404` si no existe. |
| POST | `/api/payments` | `reservationId`, `amount`, `method`, `transactionReference` | `201` con pago `approved` y reserva en estado `paid` | `404` si no existe reserva. `402` si el monto es insuficiente. |
| POST | `/api/snacks` | `reservationId`, `items`, `totalAmount` | `201` con pedido de snacks | `404` si no existe reserva. |
| POST | `/api/notifications` | `reservationId`, `type`, `recipient`, `message` | `201` con notificacion enviada | `404` si no existe reserva. |

## Flujo de integracion ante cancelaciones

Cuando se elimina una reserva mediante `DELETE /api/reservations/:id`, la API consulta los pagos aprobados asociados. En una transaccion de Firestore, cambia esos pagos a estado `refunded`, registra `refundedAt` y elimina la reserva. Al eliminar la reserva, el asiento deja de aparecer como ocupado en las validaciones futuras, por lo que queda liberado para una nueva reserva de la misma funcion.

En un flujo productivo, esta operacion se integraria con un proveedor de pagos externo. Primero se solicita la reversion al gateway, luego se confirma el resultado y finalmente se actualiza Firestore. Si la reversion falla, la reserva podria pasar a `cancel_pending_refund` para mantener trazabilidad y reintentos.

## Guia de pruebas Postman

Reemplaza `{{baseUrl}}` por la URL de Cloud Functions:

`https://us-central1-{{projectId}}.cloudfunctions.net/api`

En emulador local:

`http://127.0.0.1:5001/{{projectId}}/us-central1/api`

### 1. Success: crear reserva

`POST {{baseUrl}}/api/reservations`

```json
{
  "movieId": "movie_001",
  "showtimeId": "show_2026_05_13_1900",
  "seat": "A1",
  "customerName": "Sebastian Perez",
  "customerEmail": "sebastian@example.com",
  "totalAmount": 7.5
}
```

### 2. Error 409: asiento duplicado

Ejecuta nuevamente el mismo request anterior antes de que pasen 10 minutos:

```json
{
  "movieId": "movie_001",
  "showtimeId": "show_2026_05_13_1900",
  "seat": "A1",
  "customerName": "Otro Cliente",
  "customerEmail": "otro@example.com",
  "totalAmount": 7.5
}
```

Respuesta esperada:

```json
{
  "error": "Conflict",
  "message": "Seat already reserved for this showtime"
}
```

### 3. Error 402: monto insuficiente

`POST {{baseUrl}}/api/payments`

```json
{
  "reservationId": "{{reservationId}}",
  "amount": 3.0,
  "method": "card",
  "transactionReference": "TXN-POSTMAN-001"
}
```

Respuesta esperada:

```json
{
  "error": "Payment Required",
  "message": "Insufficient amount for transaction",
  "paymentId": "{{paymentId}}"
}
```

## Ejemplo de pelicula semilla

Crea este documento en `movies/movie_001` para probar rapidamente:

```json
{
  "title": "CineFlex Demo",
  "genre": "Drama",
  "durationMinutes": 110,
  "classification": "PG-13",
  "synopsis": "Funcion de prueba para validar reservas, pagos y snacks.",
  "posterUrl": "https://example.com/poster.jpg",
  "showtimes": [
    {
      "id": "show_2026_05_13_1900",
      "room": "Sala 1",
      "startsAt": "2026-05-13T19:00:00-05:00",
      "basePrice": 7.5
    }
  ]
}
```
