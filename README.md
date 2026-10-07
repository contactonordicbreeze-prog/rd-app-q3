# Rinde

App web para seguir el rendimiento de un FCI (por ejemplo, el de Brubank). Es **100 % estática**: no usa servidor ni base de datos. Los datos se guardan en el navegador del dispositivo (`localStorage`).

## Cómo se usa

1. **Al empezar:** nombre del fondo, fecha e importe de la inversión (y, si invertiste hace tiempo, el capital que tenés hoy).
2. **Todos los días:** botón **Cargar** → poné el **capital total** que muestra el banco, o la **ganancia del día** (la app calcula el capital).
3. **Aportes y rescates:** pestaña **Aportes** → **Nuevo**. Cargalos el día en que impactan en el fondo; el capital de ese día ya tiene que incluirlos.

Si un día no cargás nada, no pasa nada: la ganancia del registro siguiente cubre todos los días intermedios.

## Qué calcula

- **Ganancia del día** = capital de hoy − capital anterior − aportes (+ rescates) del período.
- **Rendimiento %** del día = ganancia / (capital anterior + aportes).
- **Rendimiento acumulado:** se calcula *ponderado por tiempo*, así los aportes y rescates no lo distorsionan.
- **TNA estimada** (últimos 7 días), **TEA** (últimos 30 días) y **proyección a 30 días** con esa tasa.
- Resumen por mes, calendario con la ganancia de cada día, meta de capital opcional.
- Botón del **ojo** para ocultar los importes (se ven solo los %).

## Estructura

```
index.html              página principal
css/styles.css          estilos (modo claro / oscuro)
js/app.js               toda la lógica
js/icons.js             íconos Solar de /icons incrustados (para colorearlos según el tema)
sw.js                   service worker (funciona sin conexión)
manifest.webmanifest    permite "instalarla" en el celular
icons/logo.svg          ícono de la app
```

## Probar en la PC

```bash
python -m http.server 8766
```

Y abrir http://localhost:8766

## Publicarla gratis (GitHub Pages)

1. Crear un repositorio en GitHub y subir esta carpeta.
2. En el repo: **Settings → Pages → Source: Deploy from a branch → main / root**.
3. Queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
4. En el celular, abrir esa URL y elegir **"Agregar a pantalla de inicio"**: se instala como app.

(También sirve Netlify o Cloudflare Pages: arrastrar la carpeta y listo.)

## Tus datos

- Quedan **solo en ese dispositivo y navegador**. No se suben a ningún lado.
- **Ajustes → Exportar** descarga un `.json` con todo. **Ajustes → Importar** lo carga en otro dispositivo (por ejemplo, la PC).
- **Ajustes → CSV** descarga el historial para abrirlo en Excel.
- Borrar los datos del navegador borra la app: por eso conviene exportar seguido.
