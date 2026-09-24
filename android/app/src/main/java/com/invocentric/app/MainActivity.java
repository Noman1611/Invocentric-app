package com.invocentric.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);

                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                // Add native JavascriptInterface for automated background APK downloading, updater, & direct Google Auth
                webView.addJavascriptInterface(new AppUpdateInterface(), "AndroidAppUpdater");
                webView.addJavascriptInterface(new AndroidGoogleAuthInterface(), "AndroidGoogleAuth");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent != null && intent.getData() != null) {
            handleDeepLinkUri(intent.getData());
        }
    }

    private void handleDeepLinkUri(final Uri uri) {
        if (uri == null) return;
        final String uriString = uri.toString();
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(
                            "(function(){ window.dispatchEvent(new CustomEvent('app-deep-link', { detail: { url: '" + uriString + "' } })); })();",
                            null
                        );
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    public class AndroidGoogleAuthInterface {
        @android.webkit.JavascriptInterface
        public void signIn(final String optionsJson, final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String serverClientId = null;
                        String nonce = null;
                        boolean filterByAuthorized = true;
                        boolean autoSelect = true;

                        if (optionsJson != null && !optionsJson.trim().isEmpty()) {
                            try {
                                JSONObject json = new JSONObject(optionsJson);
                                if (json.has("serverClientId")) serverClientId = json.getString("serverClientId");
                                if (json.has("nonce")) nonce = json.getString("nonce");
                                if (json.has("filterByAuthorizedAccounts")) filterByAuthorized = json.getBoolean("filterByAuthorizedAccounts");
                                if (json.has("autoSelectEnabled")) autoSelect = json.getBoolean("autoSelectEnabled");
                            } catch (Exception ignored) {}
                        }

                        CredentialManagerHelper helper = new CredentialManagerHelper(MainActivity.this);
                        helper.signIn(serverClientId, nonce, filterByAuthorized, autoSelect, new CredentialManagerHelper.AuthCallback() {
                            @Override
                            public void onSuccess(CredentialManagerHelper.AuthResult result) {
                                try {
                                    JSONObject ret = new JSONObject();
                                    ret.put("idToken", result.idToken);
                                    ret.put("email", result.email);
                                    ret.put("displayName", result.displayName);
                                    ret.put("givenName", result.givenName);
                                    ret.put("familyName", result.familyName);
                                    ret.put("photoUrl", result.photoUrl);
                                    ret.put("phoneNumber", result.phoneNumber);
                                    ret.put("nonce", result.nonce);
                                    dispatchAuthCallback(callbackId, ret.toString());
                                } catch (Exception e) {
                                    dispatchAuthError(callbackId, "EXCEPTION", e.getMessage());
                                }
                            }

                            @Override
                            public void onCancel() {
                                dispatchAuthError(callbackId, "USER_CANCELLED", "User cancelled Google Sign-In");
                            }

                            @Override
                            public void onError(String code, String message) {
                                dispatchAuthError(callbackId, code, message);
                            }
                        });
                    } catch (Exception e) {
                        dispatchAuthError(callbackId, "EXCEPTION", e.getMessage());
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void signOut(final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    CredentialManagerHelper helper = new CredentialManagerHelper(MainActivity.this);
                    helper.signOut(new CredentialManagerHelper.SignOutCallback() {
                        @Override
                        public void onComplete() {
                            dispatchAuthCallback(callbackId, "{}");
                        }
                    });
                }
            });
        }

        private void dispatchAuthCallback(final String callbackId, final String resultJson) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView wv = getBridge().getWebView();
                        if (wv != null) {
                            wv.evaluateJavascript(
                                "(function(){ if (window.__onNativeGoogleAuth) { window.__onNativeGoogleAuth('" + callbackId + "', null, " + resultJson + "); } })();",
                                null
                            );
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        private void dispatchAuthError(final String callbackId, final String code, final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView wv = getBridge().getWebView();
                        if (wv != null) {
                            JSONObject err = new JSONObject();
                            err.put("code", code);
                            err.put("message", message);
                            wv.evaluateJavascript(
                                "(function(){ if (window.__onNativeGoogleAuth) { window.__onNativeGoogleAuth('" + callbackId + "', " + err.toString() + ", null); } })();",
                                null
                            );
                        }
                    } catch (Exception ignored) {}
                }
            });
        }
    }

    public class AppUpdateInterface {
        @android.webkit.JavascriptInterface
        public String getAppVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.0.12";
            }
        }

        @android.webkit.JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(browserIntent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadAndInstallApk(final String downloadUrl) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(android.net.Uri.parse(downloadUrl));
                        request.setTitle("InvoCentric Auto-Update");
                        request.setDescription("Downloading latest InvoCentric update...");
                        request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                        final java.io.File destinationFile = new java.io.File(getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "InvoCentric.apk");
                        if (destinationFile.exists()) {
                            destinationFile.delete();
                        }
                        request.setDestinationUri(android.net.Uri.fromFile(destinationFile));

                        final android.app.DownloadManager manager = (android.app.DownloadManager) getSystemService(android.content.Context.DOWNLOAD_SERVICE);
                        if (manager != null) {
                            final long downloadId = manager.enqueue(request);

                            android.content.BroadcastReceiver onComplete = new android.content.BroadcastReceiver() {
                                @Override
                                public void onReceive(android.content.Context context, android.content.Intent intent) {
                                    long id = intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                                    if (id == downloadId) {
                                        try {
                                            unregisterReceiver(this);
                                        } catch (Exception ignored) {}

                                        try {
                                            if (destinationFile.exists()) {
                                                android.net.Uri apkUri = androidx.core.content.FileProvider.getUriForFile(
                                                    MainActivity.this,
                                                    getPackageName() + ".fileprovider",
                                                    destinationFile
                                                );
                                                android.content.Intent installIntent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                                                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                                                installIntent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                                installIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                                                startActivity(installIntent);
                                            }
                                        } catch (Exception e) {
                                            e.printStackTrace();
                                        }
                                    }
                                }
                            };

                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                                registerReceiver(onComplete, new android.content.IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE), android.content.Context.RECEIVER_EXPORTED);
                            } else {
                                registerReceiver(onComplete, new android.content.IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE));
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }
}
