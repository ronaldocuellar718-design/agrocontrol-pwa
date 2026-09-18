# AgroControl PWA — Control de Consumo de Balanceados (Celular)

Versión para celular (instalable, funciona sin internet) del sistema
de control de consumo de balanceados de Grupo Piveta. Misma lógica de
negocio y el mismo diseño que la versión de escritorio, reconstruida
como Aplicación Web Progresiva (PWA) para que se pueda instalar en un
teléfono Android o iPhone sin pasar por ninguna tienda de aplicaciones.

## 1. Cómo funciona (en una frase)

Es una página web que, al visitarla una vez desde el celular, guarda
una copia completa de sí misma en el teléfono (gracias al Service
Worker) y todos los datos que se cargan quedan guardados **en el
propio teléfono** (con IndexedDB, la "base de datos" que traen los
navegadores) — nunca viajan a ningún servidor.

## 2. Publicarla con GitHub Pages

1. Creá un repositorio nuevo en GitHub (público o privado, cualquiera
   sirve para GitHub Pages en un plan gratuito con repos públicos; si
   es privado necesitás GitHub Pro para activar Pages).
2. Subí **todo el contenido de esta carpeta** (no la carpeta en sí,
   sino lo que está adentro: `index.html`, `manifest.json`,
   `service-worker.js`, `css/`, `js/`, `vendor/`, `icons/`) a la raíz
   del repositorio.
3. Andá a **Settings → Pages** del repositorio.
4. En **"Build and deployment"**, elegí **Source: Deploy from a
   branch**.
5. En **Branch**, elegí `main` (o la que uses) y la carpeta `/ (root)`.
   Guardar.
6. Esperá 1-2 minutos. GitHub te va a dar una URL como:
   `https://tu-usuario.github.io/nombre-del-repo/`
7. Abrí esa URL en Chrome desde el celular.

## 3. Instalar en el celular

1. Con la URL abierta en Chrome (Android), tocá el menú (⋮) →
   **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.
   En iPhone (Safari): tocá el ícono de compartir → **"Agregar a
   pantalla de inicio"**.
2. Va a aparecer un ícono de AgroControl en el celular, como cualquier
   otra app instalada.
3. Abrila una vez más así el Service Worker termina de guardar todos
   los archivos.
4. **Prueba clave:** activá el modo avión y volvé a abrir la app —
   tiene que funcionar exactamente igual, sin internet.

## 4. Estructura del proyecto

```
agrocontrol_pwa/
├── index.html              Página única (shell de la app)
├── manifest.json           Metadata para que sea instalable
├── service-worker.js       Cachea todo para que funcione sin conexión
├── css/estilos.css         Estilos (misma paleta corporativa aprobada)
├── js/
│   ├── app.js              Punto de entrada: nav inferior y arranque
│   ├── utilidades.js       Formato de fechas y números
│   ├── db/                 conexion.js, esquema.js, repositorios.js, errores.js
│   │                       (todo IndexedDB vive acá — igual que database/ en Python)
│   ├── logica/             servicioRegistro.js, servicioAjustes.js, servicioConsolidado.js
│   │                       (mismas reglas de negocio que la versión de escritorio)
│   └── ui/                 Una pantalla por archivo + componentesComunes.js + iconos.js
├── js/exportacion/         exportarExcel.js (ExcelJS) y exportarPdf.js (jsPDF)
└── vendor/                 Librerías de exportación vendorizadas (sin CDN, funcionan offline)
```

Misma separación por capas que la versión de escritorio en Python:
datos (`db/`) → lógica de negocio (`logica/`) → interfaz (`ui/`).

## 5. Jerarquía de datos y reglas de negocio

Idénticas a la versión de escritorio:

- **Establecimiento** (ej. "Bahía Rica") → **Potrero** (pertenece a
  uno solo) → **Entrega** (pertenece a un solo potrero).
- Dos establecimientos pueden tener cada uno su propio "Potrero 1"
  sin confundirse — en pantalla se distinguen como
  "Establecimiento - Potrero" donde podría haber ambigüedad.
- Cargar varias entregas al mismo potrero el mismo día nunca
  sobrescribe — cada una es un evento independiente.
- Anular una entrega no la borra: se marca como anulada y se excluye
  de los reportes, pero queda en el historial.
- Desactivar un establecimiento, potrero o categoría no borra su
  historial — solo deja de aparecer en los desplegables.
- Consolidado Mensual y los dos niveles de Estadísticas Corporativas
  parten siempre de la misma fuente de datos, así que sus números
  coinciden entre sí.

## 6. Actualizar la app más adelante

Como el código vive en GitHub, actualizar es: hacer los cambios,
subirlos al repositorio (`git push`), y esperar 1-2 minutos a que
GitHub Pages los publique solo. La próxima vez que alguien abra la
app con internet, el Service Worker va a notar la nueva versión y la
va a descargar.

**Importante:** cada vez que se publique una actualización real del
código, hay que subir también un cambio en `service-worker.js`:
cambiar el número de `NOMBRE_CACHE` (ej. de `"agrocontrol-v1"` a
`"agrocontrol-v2"`). Ese cambio le indica al teléfono "hay una versión
nueva, descargala de nuevo" — si no se cambia ese número, los
teléfonos que ya instalaron la app van a seguir viendo la versión
vieja indefinidamente, aunque el código en GitHub ya esté actualizado.

Los datos cargados (establecimientos, potreros, entregas) **nunca se
pierden con una actualización** — viven en IndexedDB, completamente
aparte del código de la app, igual que en la versión de escritorio la
base de datos vive aparte del `.exe`.

## 7. Sobre la app de escritorio

Este proyecto es independiente de la versión de escritorio (PySide6 +
SQLite) que se armó primero — ambas pueden coexistir. Si en algún
momento se necesita que los datos de una reflejen en la otra, eso
requeriría un backend compartido (un servidor con base de datos
central), que es un cambio de arquitectura más grande y no está
implementado en esta versión.
