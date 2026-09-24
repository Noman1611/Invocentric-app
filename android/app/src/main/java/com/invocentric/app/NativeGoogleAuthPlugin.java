package com.invocentric.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private CredentialManagerHelper helper;

    @Override
    public void load() {
        super.load();
        helper = new CredentialManagerHelper(getActivity());
    }

    @PluginMethod
    public void signIn(final PluginCall call) {
        String serverClientId = call.getString("serverClientId", null);
        String customNonce = call.getString("nonce", null);
        boolean filterByAuthorizedAccounts = call.getBoolean("filterByAuthorizedAccounts", true);
        boolean autoSelectEnabled = call.getBoolean("autoSelectEnabled", true);

        if (helper == null) {
            helper = new CredentialManagerHelper(getActivity());
        }

        helper.signIn(serverClientId, customNonce, filterByAuthorizedAccounts, autoSelectEnabled, new CredentialManagerHelper.AuthCallback() {
            @Override
            public void onSuccess(CredentialManagerHelper.AuthResult result) {
                JSObject ret = new JSObject();
                ret.put("idToken", result.idToken);
                ret.put("email", result.email);
                ret.put("displayName", result.displayName);
                ret.put("givenName", result.givenName);
                ret.put("familyName", result.familyName);
                ret.put("photoUrl", result.photoUrl);
                ret.put("phoneNumber", result.phoneNumber);
                ret.put("nonce", result.nonce);
                call.resolve(ret);
            }

            @Override
            public void onCancel() {
                JSObject data = new JSObject();
                data.put("code", "USER_CANCELLED");
                call.reject("User cancelled Google Sign-In", "USER_CANCELLED", data);
            }

            @Override
            public void onError(String code, String message) {
                JSObject data = new JSObject();
                data.put("code", code);
                call.reject(message, code, data);
            }
        });
    }

    @PluginMethod
    public void signOut(final PluginCall call) {
        if (helper == null) {
            helper = new CredentialManagerHelper(getActivity());
        }
        helper.signOut(new CredentialManagerHelper.SignOutCallback() {
            @Override
            public void onComplete() {
                call.resolve();
            }
        });
    }
}
