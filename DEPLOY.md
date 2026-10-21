# Despliegue de SpriteForge

SpriteForge es una aplicación **Next.js solo-cliente**: guarda todo en el
`localStorage` del navegador, no usa base de datos y no necesita ningún servicio
externo para funcionar. Esta guía está enfocada en levantarla en **local con
Docker**; al final hay una nota corta sobre producción.

> El andamiaje de colaboración en tiempo real (WebSocket) y de inicio de sesión
> con Google (NextAuth) es **opcional y está desactivado por defecto**. Mientras
> no definas sus variables (`NEXT_PUBLIC_WS_URL`, `GOOGLE_CLIENT_ID`,
> `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`) la app arranca y funciona igual: el
> socket nunca intenta conectar y la ruta de auth solo se valida si se invoca.

---

## Índice

1. [Requisitos](#requisitos)
2. [Local con Docker](#local-con-docker)
3. [Actualizar](#actualizar)
4. [Problemas frecuentes](#problemas-frecuentes)
5. [Producción (nota)](#producción-nota)

---

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) con Docker Compose v2 (el
  comando `docker compose`, no `docker-compose`).

No necesitas Node ni dependencias instaladas en el host: todo el build ocurre
dentro de la imagen.

---

## Local con Docker

1. (Opcional) Crea tu archivo de entorno a partir del ejemplo. Puedes saltarte
   este paso: la app funciona sin ninguna variable.

   ```bash
   cp .env.example .env
   ```

   Rellena algún valor en `.env` **solo** si quieres activar el andamiaje
   opcional (ver `.env.example`). Para el uso normal, déjalo vacío.

2. Construye y levanta la app:

   ```bash
   docker compose up --build
   ```

   Compose construye la imagen (salida *standalone* de Next, imagen final
   mínima y no-root) y arranca el contenedor publicando el puerto 3000.

3. Abre el editor en el navegador:

   <http://localhost:3000>

Para ejecutarlo en segundo plano usa `docker compose up -d --build`, y para
detenerlo:

```bash
docker compose down
```

---

## Actualizar

Tras bajar cambios del código, reconstruye la imagen y vuelve a levantar:

```bash
docker compose up -d --build
```

> Las variables `NEXT_PUBLIC_*` se incrustan en el bundle **en tiempo de
> build**. Si cambias `NEXT_PUBLIC_WS_URL`, debes reconstruir la imagen
> (`--build`) para que el nuevo valor tenga efecto; reiniciar el contenedor no
> basta.

---

## Problemas frecuentes

- **El puerto 3000 está ocupado.** Cambia el mapeo en `docker-compose.yml`, por
  ejemplo `"8080:3000"`, y abre `http://localhost:8080`.
- **No veo mis proyectos tras cambiar de navegador o de equipo.** Es lo
  esperado: SpriteForge guarda los datos en el `localStorage` del navegador, no
  en un servidor. Cada navegador tiene su propio almacenamiento.
- **Quiero activar la colaboración o el login y no funciona.** Recuerda que esas
  variables se incrustan en build: defínelas en `.env` y reconstruye con
  `docker compose up --build`.

---

## Producción (nota)

La **misma imagen** de Docker sirve para cualquier host con Docker (un VPS, un
PaaS que ejecute contenedores, etc.): se construye igual (`docker build` o
`docker compose build`) y se arranca con `node server.js` escuchando en el
puerto 3000.

Para exponerla a Internet de forma segura, añade por tu cuenta un **proxy
inverso con TLS** (el que prefieras) delante del contenedor, que termine HTTPS
y reenvíe el tráfico al puerto 3000 de la app. SpriteForge no
maneja secretos propios, así que no hay nada adicional que proteger más allá de
servir la app bajo HTTPS.
