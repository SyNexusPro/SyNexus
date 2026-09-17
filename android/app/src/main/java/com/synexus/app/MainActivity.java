package com.synexus.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final String TAG = "Synexus";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HeraWakeWordPlugin.class);

    try {
      SplashScreen.installSplashScreen(this);
    } catch (Throwable t) {
      Log.e(TAG, "installSplashScreen", t);
    }

    super.onCreate(savedInstanceState);

    try {
      EdgeToEdge.enable(this);
    } catch (Throwable t) {
      Log.e(TAG, "EdgeToEdge", t);
    }

    View content = findViewById(android.R.id.content);
    if (content != null) {
      content.post(this::tuneWebView);
    }
  }

  @Override
  public void onResume() {
    super.onResume();
  }

  private void tuneWebView() {
    try {
      Bridge bridge = getBridge();
      if (bridge == null) {
        Log.w(TAG, "tuneWebView: Bridge is null");
        return;
      }

      WebView webView = bridge.getWebView();
      if (webView == null) {
        Log.w(TAG, "tuneWebView: WebView is null");
        return;
      }

      if (0 != (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)) {
        WebView.setWebContentsDebuggingEnabled(true);
      }

      webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

      WebSettings settings = webView.getSettings();
      settings.setCacheMode(WebSettings.LOAD_DEFAULT);
      settings.setDomStorageEnabled(true);
      settings.setJavaScriptEnabled(true);
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setDatabaseEnabled(true);
      settings.setLoadsImagesAutomatically(true);
      settings.setBlockNetworkImage(false);
      settings.setOffscreenPreRaster(true);
      settings.setUseWideViewPort(true);
      settings.setLoadWithOverviewMode(true);

      if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
        WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true);
      }
    } catch (Throwable t) {
      Log.e(TAG, "tuneWebView", t);
    }
  }
}
