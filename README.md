# vanti-api

API HTTP (Express + Puppeteer) que consulta el portal de **Vanti** y devuelve uno de tres estados:

- `DUE`  → Hay **valor a pagar** (`amount_text`, `parsed_amount`)
- `PAID` → **Referencia ya pagada**
- `NOT_FOUND` → **Referencia no encontrada**
- `ERROR`/`UNKNOWN` → Mensaje ajeno al flujo normal

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /api/v1/vanti?cuenta=61489570` (Auth con `x-api-key`)
- `POST /api/v1/vanti` body: `{ "cuenta": "61489570", "retries": 3 }`

## Respuestas

**Caso con valor:**
```json
{
  "ok": true,
  "status": "DUE",
  "account": "61489570",
  "amount_text": "$ 123.456,00",
  "currency": "COP",
  "parsed_amount": 123456,
  "fetched_at": "2025-09-24T16:10:31.123Z",
  "attempt": 1
}
```

**Caso pagada:**
```json
{
  "ok": true,
  "status": "PAID",
  "account": "61489570",
  "message": "REFERENCIA YA PAGADA",
  "fetched_at": "2025-09-24T16:10:31.123Z",
  "attempt": 1
}
```

**No encontrada:**
```json
{
  "ok": true,
  "status": "NOT_FOUND",
  "account": "61489570",
  "message": "REFERENCIA NO ENCONTRADA",
  "fetched_at": "2025-09-24T16:10:31.123Z",
  "attempt": 1
}
```

**Error:**
```json
{ "ok": false, "status": "ERROR", "account": "61489570", "error": "motivo", "fetched_at": "..." }
```

## Instalación local

```bash
npm ci
cp .env.example .env
# edita API_KEY=...
npm start
```

## Curl

```bash
curl -sS "http://localhost:8080/api/v1/vanti?cuenta=61489570" -H "x-api-key: TU_API_KEY"
```

## Despliegue en Railway

1. Conecta el repo de GitHub.
2. Variables de entorno:
   - `API_KEY` (obligatoria)
   - `PORT=8080`
   - `RETRIES=3`
   - `TZ=America/Bogota`
3. Con Dockerfile (recomendado) o Nixpacks.
4. Prueba `/health` y luego `/api/v1/vanti` con `x-api-key`.

### Notas

- El scraping usa selector directo y fallback por texto.
- Reintenta automáticamente (`retries`) con backoff.
- Si Vanti cambia HTML, ajusta `SELECTOR_VALOR` o `extractValorAPagar`.
- `parsed_amount` parsea formato colombiano (`.` miles, `,` decimales).
