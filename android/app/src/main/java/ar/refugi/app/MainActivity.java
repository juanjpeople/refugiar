package ar.refugi.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupPlugin.class);
        registerPlugin(KitchenScreenPlugin.class);
        registerPlugin(BiometricPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new StaticWebViewClient(getBridge()));
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

    private void openHouseLink(Intent intent) {
        // La instalación del laboratorio no abre casas ni enlaces de producción.
        if (!"https://refugi.ar".equals(BuildConfig.APP_ORIGIN)) return;
        Uri url = intent == null ? null : intent.getData();
        if (url == null || !"https".equals(url.getScheme()) || !"refugi.ar".equals(url.getHost()) ||
            url.getPort() != -1 || url.getUserInfo() != null) return;
        String path = url.getPath();
        if (path != null && (path.equals("/unirme") || path.equals("/c") || path.startsWith("/c/"))) {
            getBridge().getWebView().loadUrl(url.toString());
        }
    }
}
