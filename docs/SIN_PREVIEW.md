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

**Pendiente:** el despliegue automático de Cloudflare es independiente de GitHub Actions. El merge anterior se publicó antes de que terminaran los E2E, que fallaron. Apagar previews no cambia ese orden. Para hacer que producción espere a todos los checks, hace falta cambiar el mecanismo de publicación con acceso a Builds y un token de despliegue adecuado; no se habilitó una segunda vía de deploy ni se copiaron credenciales locales a GitHub.

No borrar D1, el Worker, las rutas del dominio ni secretos para ahorrar builds: son los recursos de producción.
