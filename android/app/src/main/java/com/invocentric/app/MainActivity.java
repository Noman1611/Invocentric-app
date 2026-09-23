package com.invocentric.app;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Message;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.RelativeLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                
                // Enable multi-window & popup handling for OAuth flows
                settings.setJavaScriptEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setSupportMultipleWindows(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);

                // Sanitize User Agent to remove WebView identifiers ("; wv" and "Version/4.0")
                // This prevents Google OAuth from throwing "Error 403: disallowed_useragent"
                String originalUA = settings.getUserAgentString();
                final String cleanUA = originalUA != null 
                    ? originalUA.replace("; wv", "").replaceAll("Version\\/[0-9.]+\\s?", "") 
                    : null;
                if (cleanUA != null) {
                    settings.setUserAgentString(cleanUA);
                }

                // Enable cookies for OAuth handshakes
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                // Handle Google OAuth popups directly within an in-app dialog window
                webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    private Dialog authDialog;
                    private WebView authWebView;

                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                        try {
                            Context context = MainActivity.this;
                            authWebView = new WebView(context);
                            WebSettings authSettings = authWebView.getSettings();
                            authSettings.setJavaScriptEnabled(true);
                            authSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                            authSettings.setSupportMultipleWindows(true);
                            authSettings.setDomStorageEnabled(true);
                            authSettings.setDatabaseEnabled(true);
                            if (cleanUA != null) {
                                authSettings.setUserAgentString(cleanUA);
                            }

                            CookieManager.getInstance().setAcceptCookie(true);
                            CookieManager.getInstance().setAcceptThirdPartyCookies(authWebView, true);

                            authDialog = new Dialog(context, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);

                            LinearLayout root = new LinearLayout(context);
                            root.setOrientation(LinearLayout.VERTICAL);
                            root.setLayoutParams(new LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.MATCH_PARENT
                            ));

                            // Top header bar
                            RelativeLayout topBar = new RelativeLayout(context);
                            topBar.setBackgroundColor(0xFF0F645D); // Brand green
                            int pad = (int) (14 * getResources().getDisplayMetrics().density);
                            topBar.setPadding(pad, pad, pad, pad);

                            TextView title = new TextView(context);
                            title.setText("Sign in with Google - InvoCentric");
                            title.setTextColor(0xFFFFFFFF);
                            title.setTextSize(16);
                            title.setTypeface(null, Typeface.BOLD);
                            RelativeLayout.LayoutParams titleLp = new RelativeLayout.LayoutParams(
                                RelativeLayout.LayoutParams.WRAP_CONTENT,
                                RelativeLayout.LayoutParams.WRAP_CONTENT
                            );
                            titleLp.addRule(RelativeLayout.ALIGN_PARENT_LEFT);
                            titleLp.addRule(RelativeLayout.CENTER_VERTICAL);
                            topBar.addView(title, titleLp);

                            TextView closeBtn = new TextView(context);
                            closeBtn.setText("✕ Cancel");
                            closeBtn.setTextColor(0xFFFFFFFF);
                            closeBtn.setTextSize(14);
                            closeBtn.setPadding(pad, 0, 0, 0);
                            RelativeLayout.LayoutParams closeLp = new RelativeLayout.LayoutParams(
                                RelativeLayout.LayoutParams.WRAP_CONTENT,
                                RelativeLayout.LayoutParams.WRAP_CONTENT
                            );
                            closeLp.addRule(RelativeLayout.ALIGN_PARENT_RIGHT);
                            closeLp.addRule(RelativeLayout.CENTER_VERTICAL);
                            topBar.addView(closeBtn, closeLp);

                            root.addView(topBar);

                            LinearLayout.LayoutParams webViewLp = new LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                0,
                                1.0f
                            );
                            root.addView(authWebView, webViewLp);

                            authDialog.setContentView(root);

                            closeBtn.setOnClickListener(v -> {
                                if (authDialog != null && authDialog.isShowing()) {
                                    authDialog.dismiss();
                                }
                            });

                            authDialog.setOnDismissListener(d -> {
                                if (authWebView != null) {
                                    authWebView.destroy();
                                    authWebView = null;
                                }
                                authDialog = null;
                            });

                            authWebView.setWebChromeClient(new WebChromeClient() {
                                @Override
                                public void onCloseWindow(WebView window) {
                                    if (authDialog != null && authDialog.isShowing()) {
                                        authDialog.dismiss();
                                    }
                                }
                            });

                            authWebView.setWebViewClient(new WebViewClient() {
                                @Override
                                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                                    // Retain OAuth navigation within popup dialog
                                    return false;
                                }
                            });

                            authDialog.show();

                            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                            transport.setWebView(authWebView);
                            resultMsg.sendToTarget();
                            return true;
                        } catch (Exception e) {
                            e.printStackTrace();
                            return false;
                        }
                    }

                    @Override
                    public void onCloseWindow(WebView window) {
                        if (authDialog != null && authDialog.isShowing()) {
                            authDialog.dismiss();
                        }
                        super.onCloseWindow(window);
                    }
                });

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
