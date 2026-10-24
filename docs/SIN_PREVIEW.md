# Una tanda, un PR, una publicación

## Apagar builds de preview (pendiente en el panel)

No hace falta borrar el Worker ni desconectar GitHub.

1. Entrá a [Cloudflare](https://dash.cloudflare.com/), elegí la cuenta y abrí **Workers & Pages → opendomus**. Es el Worker de `refugi.ar`.
2. Abrí **Settings → Builds → Branch control** (puede aparecer como **Build**).
3. Conservá **Production branch: main**.
4. Desactivá **Builds for non-production branches / Enable preview builds** y guardá.
5. Volvé a Builds y comprobá que el control siga apagado. Si hay un build de una rama secundaria en cola, cancelá sólo ese build.
6. En el próximo PR normal, verificá que Cloudflare no lance un build de esa rama. No hace falta crear un commit de prueba. Al integrar a `main` debe haber una sola publicación productiva.

Referencia: [control de ramas de Cloudflare](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

## Qué ya está apagado y qué falta

Verificado el 17/10/2026: no hay proyectos Pages en esta cuenta; el Worker tiene deshabilitadas las URLs `workers.dev` y de preview. El repositorio conserva `workers_dev: false` y `preview_urls: false`. Esto **no apaga los builds** de ramas: el control anterior es independiente. La API de Builds devolvió 403 con la credencial disponible; no se pudo verificar ni cambiar ese control desde el agente.

Los comandos `preview:lan` y `preview:tests` son servidores locales para probar archivos. No son ambientes en la nube ni consumen Workers Builds.

## Verificaciones antes de publicar

Mantener una sola rama de trabajo y un solo PR por tanda. Integrar cambios y correr `npm run check`, build y recorrido de API local antes del único push. La revisión visual la hace el dueño. No crear despliegues de prueba ni reejecutar CI sin una causa concreta.

Los PR ejecutan ahora el recorrido completo de CI y Android. Esperar que todos terminen correctamente antes de mergear: así Cloudflare recibe una revisión validada. Las pruebas también se conservan en main como comprobación posterior.

## Despliegue desde GitHub Actions (.github/workflows/deploy.yml)

Para evitar desajustes con credenciales locales de Wrangler (o sesiones compartidas entre múltiples proyectos), el repositorio incluye el workflow manual `Deploy Web` (`.github/workflows/deploy.yml`).

Requiere dos secretos en GitHub Actions (Settings → Secrets and variables → Actions):
1. `CLOUDFLARE_API_TOKEN`: Token de API con permisos de edición sobre Workers y D1.
2. `CLOUDFLARE_ACCOUNT_ID`: ID de cuenta de Cloudflare (por defecto `ce27a1e43f0ea22ce94a7be284d31a04`).

El workflow compila la app estática, corre las comprobaciones (`npm run check`), aplica migraciones de D1 si corresponde y publica a producción con `wrangler deploy` de forma desatendida y reproducible.

No borrar D1, el Worker, las rutas del dominio ni secretos para ahorrar builds: son los recursos de producción.
