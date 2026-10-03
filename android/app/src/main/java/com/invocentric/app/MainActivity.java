package com.invocentric.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
import android.content.pm.PackageManager;
import android.Manifest;
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

        // Request Notification permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
                }
            } catch (Exception ignored) {}
        }
        createNotificationChannel();

        handleDeepLink(getIntent());
        handleUpdateIntent(getIntent());
    }

    public static final String UPDATE_CHANNEL_ID = "invocentric_updates_channel";

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                    UPDATE_CHANNEL_ID,
                    "InvoCentric Updates",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("System notifications when a new InvoCentric update is available.");
                channel.enableVibration(true);
                NotificationManager notificationManager = getSystemService(NotificationManager.class);
                if (notificationManager != null) {
                    notificationManager.createNotificationChannel(channel);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(
                            "(function(){ window.dispatchEvent(new CustomEvent('app-resumed')); })();",
                            null
                        );
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
        handleUpdateIntent(intent);
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(
                            "(function(){ window.dispatchEvent(new CustomEvent('app-resumed')); })();",
                            null
                        );
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    private void handleUpdateIntent(Intent intent) {
        if (intent != null && "open_updater".equals(intent.getStringExtra("action"))) {
            final String downloadUrl = intent.getStringExtra("download_url");
            final String versionName = intent.getStringExtra("version_name");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            webView.evaluateJavascript(
                                "(function(){ window.dispatchEvent(new CustomEvent('app-update-notification-clicked', { detail: { downloadUrl: '" + (downloadUrl != null ? downloadUrl : "") + "', versionName: '" + (versionName != null ? versionName : "") + "' } })); })();",
                                null
                            );
                        }
                    } catch (Exception ignored) {}
                }
            });
        }
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
                        final android.app.Dialog authDialog = new android.app.Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_Dialog_NoActionBar_MinWidth);
                        authDialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);

                        android.widget.LinearLayout container = new android.widget.LinearLayout(MainActivity.this);
                        container.setOrientation(android.widget.LinearLayout.VERTICAL);
                        container.setLayoutParams(new android.view.ViewGroup.LayoutParams(
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT
                        ));

                        // Top header bar with Google branding & Cancel button
                        android.widget.RelativeLayout header = new android.widget.RelativeLayout(MainActivity.this);
                        header.setBackgroundColor(0xFF0F645D);
                        int p14 = (int) (14 * getResources().getDisplayMetrics().density);
                        header.setPadding(p14, p14, p14, p14);

                        android.widget.TextView title = new android.widget.TextView(MainActivity.this);
                        title.setText("Sign in with Google");
                        title.setTextColor(0xFFFFFFFF);
                        title.setTextSize(16);
                        title.setTypeface(null, android.graphics.Typeface.BOLD);
                        header.addView(title);

                        android.widget.TextView closeBtn = new android.widget.TextView(MainActivity.this);
                        closeBtn.setText("✕ Cancel");
                        closeBtn.setTextColor(0xFFFFFFFF);
                        closeBtn.setTextSize(14);
                        android.widget.RelativeLayout.LayoutParams closeParams = new android.widget.RelativeLayout.LayoutParams(
                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT,
                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT
                        );
                        closeParams.addRule(android.widget.RelativeLayout.ALIGN_PARENT_RIGHT);
                        closeBtn.setLayoutParams(closeParams);
                        closeBtn.setOnClickListener(new android.view.View.OnClickListener() {
                            @Override
                            public void onClick(android.view.View v) {
                                try { authDialog.dismiss(); } catch (Exception ignored) {}
                            }
                        });
                        header.addView(closeBtn);
                        container.addView(header);

                        WebView authWebView = new WebView(MainActivity.this);
                        authWebView.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
                            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                            android.widget.LinearLayout.LayoutParams.MATCH_PARENT
                        ));
                        WebSettings ws = authWebView.getSettings();
                        ws.setJavaScriptEnabled(true);
                        ws.setDomStorageEnabled(true);
                        ws.setDatabaseEnabled(true);
                        ws.setSupportMultipleWindows(true);
                        ws.setJavaScriptCanOpenWindowsAutomatically(true);
                        CookieManager.getInstance().setAcceptThirdPartyCookies(authWebView, true);

                        authWebView.setWebViewClient(new android.webkit.WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                                String reqUrl = request.getUrl().toString();
                                if (reqUrl.startsWith("invocentric://") || reqUrl.startsWith("com.invocentric.app://") || reqUrl.startsWith("intent://auth")) {
                                    handleDeepLink(new Intent(Intent.ACTION_VIEW, Uri.parse(reqUrl)));
                                    try { authDialog.dismiss(); } catch (Exception ignored) {}
                                    return true;
                                }
                                return false;
                            }
                        });

                        container.addView(authWebView);
                        authDialog.setContentView(container);

                        android.view.Window window = authDialog.getWindow();
                        if (window != null) {
                            window.setLayout(
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                (int) (getResources().getDisplayMetrics().heightPixels * 0.88)
                            );
                            window.setGravity(android.view.Gravity.BOTTOM);
                        }

                        authDialog.show();
                        authWebView.loadUrl(url);
                    } catch (Exception e) {
                        e.printStackTrace();
                        try {
                            androidx.browser.customtabs.CustomTabsIntent.Builder builder = new androidx.browser.customtabs.CustomTabsIntent.Builder();
                            builder.setShowTitle(true);
                            builder.setToolbarColor(0xFF0F645D);
                            androidx.browser.customtabs.CustomTabsIntent customTabsIntent = builder.build();
                            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            customTabsIntent.launchUrl(MainActivity.this, Uri.parse(url));
                        } catch (Exception ex) {
                            openExternalUrl(url);
                        }
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

        @android.webkit.JavascriptInterface
        public void showUpdateNotification(final String title, final String message, final String downloadUrl, final String versionName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        createNotificationChannel();

                        Intent notifyIntent = new Intent(MainActivity.this, MainActivity.class);
                        notifyIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        notifyIntent.putExtra("action", "open_updater");
                        notifyIntent.putExtra("download_url", downloadUrl);
                        notifyIntent.putExtra("version_name", versionName);

                        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            flags |= PendingIntent.FLAG_IMMUTABLE;
                        }

                        PendingIntent pendingIntent = PendingIntent.getActivity(MainActivity.this, 2001, notifyIntent, flags);

                        NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, UPDATE_CHANNEL_ID)
                            .setSmallIcon(R.mipmap.ic_launcher)
                            .setContentTitle(title != null && !title.trim().isEmpty() ? title : "InvoCentric Update Available! 🚀")
                            .setContentText(message != null && !message.trim().isEmpty() ? message : "New version v" + (versionName != null ? versionName : "") + " is ready. Tap to update.")
                            .setStyle(new NotificationCompat.BigTextStyle().bigText(message != null && !message.trim().isEmpty() ? message : "A new version of InvoCentric is available. Tap to update."))
                            .setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setDefaults(NotificationCompat.DEFAULT_ALL)
                            .setAutoCancel(true)
                            .setContentIntent(pendingIntent);

                        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        if (notificationManager != null) {
                            notificationManager.notify(1001, builder.build());
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
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
        public void shareToWhatsApp(final String base64Data, final String fileName, final String phoneNumber, final String shareText) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType("application/pdf");

                        if (shareText != null && !shareText.trim().isEmpty()) {
                            shareIntent.putExtra(Intent.EXTRA_TEXT, shareText);
                        }

                        if (base64Data != null && !base64Data.trim().isEmpty()) {
                            String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                            byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                            File shareDir = new File(getCacheDir(), "shared");
                            if (!shareDir.exists()) shareDir.mkdirs();
                            String safeFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName : ("Invoice_" + System.currentTimeMillis() + ".pdf");
                            File shareFile = new File(shareDir, safeFileName);
                            try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                                fos.write(fileBytes);
                                fos.flush();
                            }

                            Uri contentUri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", shareFile);
                            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        }

                        // Target WhatsApp directly
                        PackageManager pm = getPackageManager();
                        boolean whatsappFound = false;
                        String[] targetPackages = new String[]{"com.whatsapp", "com.whatsapp.w4b"};

                        String cleanPhone = (phoneNumber != null) ? phoneNumber.replaceAll("[^0-9]", "") : "";
                        if (cleanPhone.length() == 10) {
                            cleanPhone = "91" + cleanPhone;
                        }

                        for (String pkg : targetPackages) {
                            try {
                                pm.getPackageInfo(pkg, PackageManager.GET_META_DATA);
                                shareIntent.setPackage(pkg);
                                if (!cleanPhone.isEmpty()) {
                                    shareIntent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
                                }
                                whatsappFound = true;
                                break;
                            } catch (PackageManager.NameNotFoundException ignored) {}
                        }

                        if (whatsappFound) {
                            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(shareIntent);
                        } else {
                            Intent chooser = Intent.createChooser(shareIntent, "Share Invoice via");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(chooser);
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        Toast.makeText(MainActivity.this, "WhatsApp Share error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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
