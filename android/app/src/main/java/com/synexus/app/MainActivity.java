package com.synexus.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onResume() {
    super.onResume();
    tuneWebView();
  }

  private void tuneWebView() {
    Bridge bridge = getBridge();
    if (bridge == null) return;
    WebView webView = bridge.getWebView();
    if (webView == null) return;

    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

    WebSettings settings = webView.getSettings();
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setDomStorageEnabled(true);
    settings.setOffscreenPreRaster(true);
  }
}
