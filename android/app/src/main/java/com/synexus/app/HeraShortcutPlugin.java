package com.synexus.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HeraShortcut")
public class HeraShortcutPlugin extends Plugin {
  @PluginMethod
  public void pin(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.synexus.pro/owner/hera"));
    intent.setClass(getContext(), MainActivity.class);
    ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(getContext(), "hera")
        .setShortLabel("Hera")
        .setLongLabel("Titan AI")
        .setIcon(IconCompat.createWithResource(getContext(), R.drawable.ic_hera))
        .setIntent(intent)
        .build();
    boolean requested = false;
    if (getActivity() != null && ShortcutManagerCompat.isRequestPinShortcutSupported(getContext())) {
      requested = ShortcutManagerCompat.requestPinShortcut(getActivity(), shortcut, null);
    }
    JSObject out = new JSObject();
    out.put("requested", requested);
    call.resolve(out);
  }
}
