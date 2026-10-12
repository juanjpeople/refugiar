package ar.refugi.app;

import android.net.Uri;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.Map;
import java.util.Collections;

/** Next exports one HTML per route; Capacitor's default fallback always serves the home HTML. */
final class StaticWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;

    StaticWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        // La API puede devolver HTML (OAuth). Nunca darle el puente nativo ni navegar
        // contenido remoto dentro de la app: la autenticación externa requiere un handoff.
        String path = url.getPath();
        if (!isAppOrigin(url) || isApi(path) || (path != null && path.startsWith("/admin"))) {
            String scheme = url.getScheme();
            if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
                try { bridge.getContext().startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                catch (ActivityNotFoundException ignored) { /* No navegador externo instalado. */ }
            }
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    private static boolean isAppOrigin(Uri url) {
        Uri origin = Uri.parse(BuildConfig.APP_ORIGIN);
        return origin.getScheme().equals(url.getScheme()) && origin.getHost().equals(url.getHost()) &&
            url.getPort() == origin.getPort() && url.getUserInfo() == null;
    }

    private static boolean isApi(String path) {
        return path != null && (path.equals("/api") || path.startsWith("/api/"));
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String path = url.getPath();
        if (isAppOrigin(url) && isApi(path)) {
            if (!request.isForMainFrame()) return null; // HTTPS real, cookies propias de WebView.
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
        if (request.isForMainFrame() && "GET".equals(request.getMethod()) &&
            isAppOrigin(url) &&
            path != null && path.matches("/(?:[a-zA-Z0-9_-]+/?)*") && !"/".equals(path)) {
            String html = path.replaceAll("/+$", "") + ".html";
            try (InputStream ignored = bridge.getContext().getAssets().open("public" + html)) {
                // Packaged assets are immutable. Only known static routes receive their own HTML.
            } catch (IOException missing) {
                html = "/404.html";
            }
            Uri destination = url.buildUpon().path(html).build();
            return super.shouldInterceptRequest(view, new WebResourceRequest() {
                public Uri getUrl() { return destination; }
                public boolean isForMainFrame() { return request.isForMainFrame(); }
                public boolean isRedirect() { return request.isRedirect(); }
                public boolean hasGesture() { return request.hasGesture(); }
                public String getMethod() { return request.getMethod(); }
                public Map<String, String> getRequestHeaders() { return request.getRequestHeaders(); }
            });
        }
        return super.shouldInterceptRequest(view, request);
    }
}
