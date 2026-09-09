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
    Log.d(TAG, "onCreate: Starting app");

    registerPlugin(HeraWakeWordPlugin.class);

    // Enable Edge-to-Edge BEFORE super.onCreate to properly handle system bars
    EdgeToEdge.enable(this);
    
    // Install Splash Screen
    SplashScreen.installSplashScreen(this);
    
    super.onCreate(savedInstanceState);
    
    // Schedule WebView tuning after the bridge has initialized
    findViewById(android.R.id.content).post(this::tuneWebView);
    
    Log.d(TAG, "onCreate: Finished initialization");
  }

  @Override
  public void onResume() {
    super.onResume();
  }

  private void tuneWebView() {
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

    Log.d(TAG, "tuneWebView: Configuring WebView");

    if (0 != (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)) {
      WebView.setWebContentsDebuggingEnabled(true);
    }

    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

    WebSettings settings = webView.getSettings();
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setDomStorageEnabled(true);
    settings.setJavaScriptEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setDatabaseEnabled(true);
    settings.setLoadsImagesAutomatically(true);
    settings.setBlockNetworkImage(false);
    
    // Performance and display optimizations
    settings.setOffscreenPreRaster(true);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);

    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
      WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true);
    }
    
    Log.d(TAG, "tuneWebView: WebView configuration complete");
  }
}
