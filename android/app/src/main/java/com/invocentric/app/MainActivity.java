package com.invocentric.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.CancellationSignal;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.print.PageRange;
import android.content.ContentValues;
import android.content.ContentResolver;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

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
                webView.addJavascriptInterface(new AndroidPrintInterface(), "AndroidPrinter");
                webView.addJavascriptInterface(new AndroidFileInterface(), "AndroidFileManager");

                webView.setDownloadListener(new android.webkit.DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                        if (url != null) {
                            if (url.startsWith("blob:") || url.startsWith("data:")) {
                                webView.evaluateJavascript(
                                    "(function(){ if (window.__handleAndroidDownload) { window.__handleAndroidDownload('" + url + "', '" + (mimeType != null ? mimeType : "") + "'); } })()",
                                    null
                                );
                            } else {
                                try {
                                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(i);
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                });
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
                return "1.0.23";
            }
        }

        @android.webkit.JavascriptInterface
        public void openAuthCustomTab(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        androidx.browser.customtabs.CustomTabsIntent.Builder builder = new androidx.browser.customtabs.CustomTabsIntent.Builder();
                        builder.setShowTitle(true);
                        builder.setToolbarColor(0xFF0F645D); // Brand green
                        androidx.browser.customtabs.CustomTabsIntent customTabsIntent = builder.build();
                        customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                        customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        customTabsIntent.launchUrl(MainActivity.this, Uri.parse(url));
                    } catch (Exception e) {
                        e.printStackTrace();
                        openExternalUrl(url);
                    }
                }
            });
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
                        // Check if Android 8.0+ has unknown app install permission
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                            if (!getPackageManager().canRequestPackageInstalls()) {
                                try {
                                    Intent unknownAppIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                                    unknownAppIntent.setData(Uri.parse("package:" + getPackageName()));
                                    unknownAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(unknownAppIntent);
                                } catch (Exception permErr) {
                                    permErr.printStackTrace();
                                }
                            }
                        }

                        android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(android.net.Uri.parse(downloadUrl));
                        request.setTitle("InvoCentric Update");
                        request.setDescription("Downloading latest InvoCentric update package...");
                        request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                        final java.io.File destinationFile = new java.io.File(getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "InvoCentric.apk");
                        if (destinationFile.exists()) {
                            destinationFile.delete();
                        }
                        request.setDestinationInExternalFilesDir(MainActivity.this, android.os.Environment.DIRECTORY_DOWNLOADS, "InvoCentric.apk");

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
                                            android.app.DownloadManager.Query query = new android.app.DownloadManager.Query();
                                            query.setFilterById(downloadId);
                                            android.database.Cursor cursor = manager.query(query);
                                            boolean isSuccess = false;
                                            if (cursor != null) {
                                                if (cursor.moveToFirst()) {
                                                    int statusCol = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_STATUS);
                                                    if (statusCol != -1 && cursor.getInt(statusCol) == android.app.DownloadManager.STATUS_SUCCESSFUL) {
                                                        isSuccess = true;
                                                    }
                                                }
                                                cursor.close();
                                            }

                                            if (isSuccess && destinationFile.exists() && destinationFile.length() > 0) {
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

        @android.webkit.JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finishAffinity();
                }
            });
        }
    }

    public class AndroidPrintInterface {
        @android.webkit.JavascriptInterface
        public void print(final String jobName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                String name = (jobName != null && !jobName.trim().isEmpty()) ? jobName : "InvoCentric_Document";
                                PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(name);
                                printManager.print(name, printAdapter, new PrintAttributes.Builder().build());
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void printPdf(final String base64Data, final String jobName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (base64Data == null || base64Data.trim().isEmpty()) return;
                        String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                        byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                        File tempDir = new File(getCacheDir(), "print");
                        if (!tempDir.exists()) tempDir.mkdirs();
                        final File pdfFile = new File(tempDir, "print_" + System.currentTimeMillis() + ".pdf");
                        try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                            fos.write(pdfBytes);
                            fos.flush();
                        }

                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            final String name = (jobName != null && !jobName.trim().isEmpty()) ? jobName : "InvoCentric_Document";
                            PrintDocumentAdapter printAdapter = new PrintDocumentAdapter() {
                                @Override
                                public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                                    if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                                        callback.onLayoutCancelled();
                                        return;
                                    }
                                    PrintDocumentInfo info = new PrintDocumentInfo.Builder(name + ".pdf")
                                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                        .build();
                                    callback.onLayoutFinished(info, true);
                                }

                                @Override
                                public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                                    InputStream in = null;
                                    OutputStream out = null;
                                    try {
                                        in = new FileInputStream(pdfFile);
                                        out = new FileOutputStream(destination.getFileDescriptor());
                                        byte[] buf = new byte[16384];
                                        int bytesRead;
                                        while ((bytesRead = in.read(buf)) > 0) {
                                            if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                                                callback.onWriteCancelled();
                                                return;
                                            }
                                            out.write(buf, 0, bytesRead);
                                        }
                                        callback.onWriteFinished(new PageRange[]{ PageRange.ALL_PAGES });
                                    } catch (Exception e) {
                                        callback.onWriteFailed(e.getMessage());
                                    } finally {
                                        try { if (in != null) in.close(); } catch (Exception ignored) {}
                                        try { if (out != null) out.close(); } catch (Exception ignored) {}
                                    }
                                }
                            };
                            printManager.print(name, printAdapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }

    public class AndroidFileInterface {
        @android.webkit.JavascriptInterface
        public void saveFile(final String base64Data, final String fileName, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (base64Data == null || base64Data.trim().isEmpty()) return;
                        String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                        byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                        String safeFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName : ("file_" + System.currentTimeMillis());
                        String actualMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType : "application/octet-stream";

                        boolean saved = false;

                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                            try {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeFileName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, actualMime);
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/InvoCentric");

                                ContentResolver resolver = getContentResolver();
                                Uri fileUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                if (fileUri != null) {
                                    try (OutputStream os = resolver.openOutputStream(fileUri)) {
                                        if (os != null) {
                                            os.write(fileBytes);
                                            os.flush();
                                            saved = true;
                                        }
                                    }
                                }
                            } catch (Exception qErr) {
                                qErr.printStackTrace();
                            }
                        }

                        if (!saved) {
                            File downloadDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                            if (downloadDir == null || !downloadDir.exists()) {
                                downloadDir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                            }
                            if (downloadDir != null) {
                                File targetFile = new File(downloadDir, safeFileName);
                                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                                    fos.write(fileBytes);
                                    fos.flush();
                                    saved = true;
                                }
                            }
                        }

                        if (saved) {
                            Toast.makeText(MainActivity.this, "Saved to Downloads: " + safeFileName, Toast.LENGTH_LONG).show();
                        } else {
                            Toast.makeText(MainActivity.this, "Failed to save file", Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        Toast.makeText(MainActivity.this, "Save error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void shareFile(final String base64Data, final String fileName, final String mimeType, final String shareText) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        String actualMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType : "*/*";
                        shareIntent.setType(actualMime);

                        if (shareText != null && !shareText.trim().isEmpty()) {
                            shareIntent.putExtra(Intent.EXTRA_TEXT, shareText);
                        }

                        if (base64Data != null && !base64Data.trim().isEmpty()) {
                            String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                            byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                            File shareDir = new File(getCacheDir(), "shared");
                            if (!shareDir.exists()) shareDir.mkdirs();
                            String safeFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName : ("doc_" + System.currentTimeMillis() + ".pdf");
                            File shareFile = new File(shareDir, safeFileName);
                            try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                                fos.write(fileBytes);
                                fos.flush();
                            }

                            Uri contentUri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", shareFile);
                            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        }

                        Intent chooser = Intent.createChooser(shareIntent, "Share via");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(chooser);
                    } catch (Exception e) {
                        e.printStackTrace();
                        Toast.makeText(MainActivity.this, "Share error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void openWhatsApp(final String phoneNumber, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String cleanPhone = (phoneNumber != null) ? phoneNumber.replaceAll("[^0-9]", "") : "";
                        String url = "https://api.whatsapp.com/send?phone=" + cleanPhone + "&text=" + java.net.URLEncoder.encode(text != null ? text : "", "UTF-8");
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
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
    }


    @Override
    public void onBackPressed() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(
                    "(function(){ " +
                    "  var event = new CustomEvent('android-back-pressed', { cancelable: true }); " +
                    "  var notHandled = window.dispatchEvent(event); " +
                    "  return notHandled; " +
                    "})()",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if ("false".equals(value)) {
                                // Handled in JS!
                                return;
                            }
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                MainActivity.super.onBackPressed();
                            }
                        }
                    }
                );
                return;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        super.onBackPressed();
    }
}
