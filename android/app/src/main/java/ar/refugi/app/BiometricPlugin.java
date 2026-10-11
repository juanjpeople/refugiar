package ar.refugi.app;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.UUID;

@CapacitorPlugin(name = "LocalBiometric")
public class BiometricPlugin extends Plugin {
    private static final String PREFIX = "refugiar.biometric.";
    private BiometricPrompt prompt;
    private PluginCall pending;

    private int authenticators() {
        return Build.VERSION.SDK_INT >= 30
            ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            : BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    private KeyStore keys() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    private String alias(String id) {
        if (id == null || !id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("Invalid credential");
        return PREFIX + id;
    }

    @PluginMethod
    public void support(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BiometricManager.from(getContext()).canAuthenticate(authenticators()) == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    @PluginMethod
    public void register(PluginCall call) {
        authenticate(call, true);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        authenticate(call, false);
    }

    private void authenticate(PluginCall call, boolean registering) {
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Another biometric request is active", "busy"); return; }
            String id = null;
            try {
                KeyStore store = keys();
                if (registering) {
                    id = UUID.randomUUID().toString();
                    KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(alias(id), KeyProperties.PURPOSE_SIGN)
                        .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .setUserAuthenticationRequired(true);
                    if (Build.VERSION.SDK_INT >= 30) {
                        spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
                    } else {
                        spec.setUserAuthenticationValidityDurationSeconds(-1);
                        spec.setInvalidatedByBiometricEnrollment(true);
                    }
                    KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
                    generator.initialize(spec.build());
                    generator.generateKeyPair();
                } else {
                    JSArray ids = call.getArray("ids");
                    if (ids == null) throw new IllegalArgumentException("Missing credentials");
                    for (int i = 0; i < ids.length(); i++) {
                        String candidate = ids.getString(i);
                        if (store.containsAlias(alias(candidate))) { id = candidate; break; }
                    }
                    if (id == null) { call.reject("Use the profile PIN to recover access", "unavailable"); return; }
                }
                byte[] challenge = Base64.decode(call.getString("challenge", ""), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
                if (challenge.length != 32) throw new IllegalArgumentException("Invalid challenge");
                Signature signature = Signature.getInstance("SHA256withECDSA");
                signature.initSign((java.security.PrivateKey) store.getKey(alias(id), null));
                String credentialId = id;
                pending = call;
                prompt = new BiometricPrompt((FragmentActivity) getActivity(), ContextCompat.getMainExecutor(getContext()),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            try {
                                Signature verified = result.getCryptoObject() == null ? null : result.getCryptoObject().getSignature();
                                if (verified == null) throw new IllegalStateException("Missing verification");
                                verified.update(challenge);
                                JSObject response = new JSObject();
                                response.put("id", credentialId);
                                response.put("signature", Base64.encodeToString(verified.sign(), Base64.NO_WRAP));
                                response.put("publicKey", Base64.encodeToString(store.getCertificate(alias(credentialId)).getPublicKey().getEncoded(), Base64.NO_WRAP));
                                pending = null;
                                call.resolve(response);
                            } catch (Exception error) {
                                fail(call, credentialId, registering, "failed");
                            }
                        }

                        @Override
                        public void onAuthenticationError(int code, @NonNull CharSequence text) {
                            fail(call, credentialId, registering, "cancelled");
                        }
                    });
                BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(call.getString("title", "Refugiar"))
                    .setSubtitle(call.getString("subtitle", ""))
                    .setAllowedAuthenticators(authenticators());
                if (Build.VERSION.SDK_INT < 30) info.setNegativeButtonText(call.getString("cancel", "Cancel"));
                prompt.authenticate(info.build(), new BiometricPrompt.CryptoObject(signature));
            } catch (Exception error) {
                fail(call, id, registering, "unavailable");
            }
        });
    }

    private void fail(PluginCall call, String id, boolean registering, String code) {
        pending = null;
        if (registering && id != null) {
            try { keys().deleteEntry(alias(id)); }
            catch (Exception error) { call.reject("Could not remove biometric key", "failed"); return; }
        }
        call.reject("Biometric verification was not completed", code);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            keys().deleteEntry(alias(call.getString("id")));
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not remove biometric key", "failed");
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (prompt != null && pending != null) prompt.cancelAuthentication();
    }
}
