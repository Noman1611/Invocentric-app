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
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
