package ar.refugi.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    /** Atajos del ícono y "Compartir" desde otra app: abren solo estas pantallas de la app. */
    static final String OPEN_ACTION = "ar.refugi.app.OPEN";
    private static final List<String> ROUTES = Arrays.asList("/compras", "/inventario/escanear", "/calendario", "/emergencias");
    /** Una lista pegada no necesita más; corta textos enormes antes de armar la dirección. */
    private static final int MAX_SHARED_TEXT = 8000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupPlugin.class);
        registerPlugin(KitchenScreenPlugin.class);
        registerPlugin(BiometricPlugin.class);
        super.onCreate(savedInstanceState);
        updateSystemBarsColor();
        getBridge().setWebViewClient(new StaticWebViewClient(getBridge()));
        publishShortcuts();
        openHouseLink(getIntent());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
                if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
                    new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView()).hide(WindowInsetsCompat.Type.ime());
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "Boolean(window.refugiarHandleBack && window.refugiarHandleBack())",
                    handled -> {
                        if ("true".equals(handled)) return;
                        if (getBridge().getWebView().canGoBack()) getBridge().getWebView().goBack();
                        else moveTaskToBack(true);
                    }
                );
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openHouseLink(intent);
    }

    /** Mantener apretado el ícono: Compras, Escanear, Calendario y Emergencias. */
    private void publishShortcuts() {
        try {
            List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
            shortcuts.add(shortcut("compras", "/compras", R.string.shortcut_shopping, R.drawable.ic_shortcut_shopping));
            shortcuts.add(shortcut("escanear", "/inventario/escanear", R.string.shortcut_scan, R.drawable.ic_shortcut_scan));
            shortcuts.add(shortcut("calendario", "/calendario", R.string.shortcut_calendar, R.drawable.ic_shortcut_calendar));
            shortcuts.add(shortcut("emergencias", "/emergencias", R.string.shortcut_emergency, R.drawable.ic_shortcut_emergency));
            ShortcutManagerCompat.setDynamicShortcuts(this, shortcuts);
        } catch (RuntimeException ignored) {
            // Algunos lanzadores no admiten atajos: la app funciona igual.
        }
    }

    private ShortcutInfoCompat shortcut(String id, String route, int label, int icon) {
        Intent intent = new Intent(this, MainActivity.class).setAction(OPEN_ACTION).putExtra("route", route)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return new ShortcutInfoCompat.Builder(this, id)
            .setShortLabel(getString(label))
            .setIcon(IconCompat.createWithResource(this, icon))
            .setIntent(intent)
            .build();
    }

    private void openRoute(String route) {
        getBridge().getWebView().loadUrl(BuildConfig.APP_ORIGIN + route);
    }

    private void openHouseLink(Intent intent) {
        if (intent == null) return;
        // Atajo del ícono: solo rutas conocidas, nunca una dirección armada por otra app.
        if (OPEN_ACTION.equals(intent.getAction())) {
            String route = intent.getStringExtra("route");
            if (route != null && ROUTES.contains(route)) openRoute(route);
            return;
        }
        // Texto compartido desde otra app (WhatsApp, Notas): va a Compras para revisarlo antes de sumarlo.
        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            CharSequence shared = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (shared == null) return;
            String text = shared.toString().trim();
            if (text.isEmpty()) return;
            if (text.length() > MAX_SHARED_TEXT) text = text.substring(0, MAX_SHARED_TEXT);
            openRoute("/compras?pegar=" + Uri.encode(text));
            return;
        }
        // La instalación del laboratorio no abre casas ni enlaces de producción.
        if (!"https://refugi.ar".equals(BuildConfig.APP_ORIGIN)) return;
        Uri url = intent.getData();
        if (url == null || !"https".equals(url.getScheme()) || !"refugi.ar".equals(url.getHost()) ||
            url.getPort() != -1 || url.getUserInfo() != null) return;
        String path = url.getPath();
        if (path != null && (path.equals("/unirme") || path.equals("/compartido") || path.equals("/c") || path.startsWith("/c/"))) {
            getBridge().getWebView().loadUrl(url.toString());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        updateSystemBarsColor();
    }

    private void updateSystemBarsColor() {
        int nightMode = getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        boolean isDark = nightMode == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        android.view.Window window = getWindow();
        window.setNavigationBarColor(isDark ? android.graphics.Color.BLACK : android.graphics.Color.parseColor("#F5F5F5"));
        WindowInsetsControllerCompat insetsController = new WindowInsetsControllerCompat(window, window.getDecorView());
        insetsController.setAppearanceLightNavigationBars(!isDark);
    }
}
