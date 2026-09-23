package com.invocentric.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                
                // Enable multi-window & popup handling for OAuth flows
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);

                // Sanitize User Agent to remove WebView identifiers ("; wv" and "Version/4.0")
                // This prevents Google OAuth from throwing "Error 403: disallowed_useragent"
                String originalUA = settings.getUserAgentString();
                if (originalUA != null) {
                    String cleanUA = originalUA.replace("; wv", "").replaceAll("Version\\/[0-9.]+\\s?", "");
                    settings.setUserAgentString(cleanUA);
                }
                // Add native JavascriptInterface for automated background APK downloading & install trigger
                webView.addJavascriptInterface(new AppUpdateInterface(), "AndroidAppUpdater");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    class AppUpdateInterface {
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
