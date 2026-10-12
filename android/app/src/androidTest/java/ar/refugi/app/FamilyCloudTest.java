package ar.refugi.app;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.content.Context;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exclusivo del APK .lab y de las cuentas ficticias del laboratorio local. */
@RunWith(AndroidJUnit4.class)
public class FamilyCloudTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        NativeFlowTest.onActivity(scenario, activity -> activity.getBridge().getWebView()
            .evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView sin respuesta", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void await(ActivityScenario<MainActivity> scenario, String condition) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 45000;
        do {
            if ("true".equals(evaluate(scenario, "Boolean(" + condition + ")"))) return;
            SystemClock.sleep(200);
        } while (SystemClock.elapsedRealtime() < deadline);
        // No imprimir formularios ni credenciales en resultados de instrumentación.
        fail("No se cumplió: " + condition + "; ruta=" + evaluate(scenario, "location.pathname")
            + "; avisos=" + evaluate(scenario, "Array.from(document.querySelectorAll('.ant-message-notice-content,.ant-form-item-explain-error')).map(e=>e.textContent)")
            + "; botones=" + evaluate(scenario, "Array.from(document.querySelectorAll('button')).map(e=>e.textContent.trim())"));
    }

    private void navigate(ActivityScenario<MainActivity> scenario, String path) {
        NativeFlowTest.onActivity(scenario, activity -> activity.getBridge().getWebView().loadUrl(BuildConfig.APP_ORIGIN + path));
    }

    private void fill(ActivityScenario<MainActivity> scenario, String selector, String value) throws Exception {
        evaluate(scenario, "(() => {const e=document.querySelector(" + JSONObject.quote(selector) + ");"
            + "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e," + JSONObject.quote(value) + ");"
            + "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()");
    }

    @Test public void passwordAccountDownloadsRealFamilyThenOpensWithoutNetwork() throws Exception {
        assumeTrue(BuildConfig.APPLICATION_ID.equals("ar.refugi.app.lab"));
        Context context = ApplicationProvider.getApplicationContext();
        File fixture = new File(context.getExternalFilesDir(null), "family-account.json");
        assertTrue("Preparar family-account.json con la cuenta ficticia antes de instrumentar", fixture.isFile());
        JSONObject account = new JSONObject(new String(Files.readAllBytes(fixture.toPath()), StandardCharsets.UTF_8));
        assertTrue(account.getString("email").endsWith("@example.test"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            navigate(scenario, "/cuenta?modo=entrar");
            await(scenario, "document.querySelector('input[type=email]') && window.Capacitor?.isNativePlatform()");
            assertEquals("\"http://localhost:4195\"", evaluate(scenario, "location.origin"));
            assertEquals("true", evaluate(scenario, "window.isSecureContext && !!crypto.subtle"));
            evaluate(scenario, "window.__cryptoMissing=null;Promise.all(['X25519','Ed25519'].map(async name=>{try{await crypto.subtle.generateKey({name},false,name==='X25519'?['deriveBits']:['sign','verify']);return null}catch{return name}})).then(values=>window.__cryptoMissing=values.filter(Boolean))");
            await(scenario, "window.__cryptoMissing !== null");
            assertEquals("Actualizar Android System WebView: faltan algoritmos requeridos", "[]", evaluate(scenario, "window.__cryptoMissing"));
            evaluate(scenario, "window.__health=null;fetch('/api/me').then(r=>window.__health=r.status).catch(()=>window.__health='network-error')");
            await(scenario, "window.__health !== null");
            assertEquals("API local por adb reverse", "200", evaluate(scenario, "window.__health"));
            fill(scenario, "input[type=email]", account.getString("email"));
            fill(scenario, "input[type=password]", account.getString("password"));
            evaluate(scenario, "document.querySelector('button[type=submit]').click()");
            await(scenario, "location.pathname === '/' || Array.from(document.querySelectorAll('button')).some(b=>/^(Ir a mi casa|Go to my home)$/.test(b.textContent.trim()))");
            evaluate(scenario, "Array.from(document.querySelectorAll('button')).find(b=>/^(Ir a mi casa|Go to my home)$/.test(b.textContent.trim()))?.click()");
            await(scenario, "location.pathname === '/'");
            evaluate(scenario, "window.__me=null;fetch('/api/me').then(r=>r.json()).then(v=>window.__me=v)");
            await(scenario, "window.__me?.user && window.__me?.households?.length > 0");
            JSONObject me = new JSONObject(evaluate(scenario, "window.__me"));
            assertEquals(account.getString("userId"), me.getJSONObject("user").getString("id"));
            assertEquals(account.getString("householdId"), me.getJSONArray("households").getJSONObject(0).getString("id"));
            navigate(scenario, "/inventario");
            await(scenario, "document.body.innerText.includes('Heladera')");
            evaluate(scenario, "Array.from(document.querySelectorAll('*')).find(e=>e.childElementCount===0 && e.textContent.trim()==='Heladera')?.click()");
            await(scenario, "location.pathname === '/inventario/ver'");
            await(scenario, "document.body.innerText.includes('Arroz del laboratorio')");
            evaluate(scenario, "window.__beforeReload=true");
            NativeFlowTest.onActivity(scenario, activity -> {
                activity.getBridge().getWebView().getSettings().setBlockNetworkLoads(true);
                activity.getBridge().getWebView().reload();
            });
            await(scenario, "!window.__beforeReload && document.body.innerText.includes('Arroz del laboratorio')");
            evaluate(scenario, "window.__network=null;fetch('/api/me').then(()=>window.__network='unexpected').catch(()=>window.__network='blocked')");
            await(scenario, "window.__network === 'blocked'");
            assertEquals("true", evaluate(scenario, "window.Capacitor.isNativePlatform()"));
        } finally {
            assertTrue("No se pudo retirar el archivo de credenciales ficticias", fixture.delete());
        }
    }
}
