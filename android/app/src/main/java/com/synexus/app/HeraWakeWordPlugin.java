package com.synexus.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * On-device wake-word listener for “Hera” (alias “Titan”).
 * Uses Android SpeechRecognizer with EXTRA_PREFER_OFFLINE so mic audio is not
 * uploaded to SyNexus. Swap this engine for Porcupine/Vosk later without
 * changing the JS HeraWakeWord plugin API.
 *
 * Foreground only — do not start a background service from this plugin.
 */
@CapacitorPlugin(
    name = "HeraWakeWord",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class HeraWakeWordPlugin extends Plugin {
  private static final String TAG = "HeraWakeWord";
  private static final Pattern WAKE =
      Pattern.compile(
          "(?:(?:hey|hi|ok|okay|yo)\\s+)?(?:hera|hara|heera|titan|tighten|tyton)\\b[,.!?]?",
          Pattern.CASE_INSENSITIVE);

  private final Handler main = new Handler(Looper.getMainLooper());
  private SpeechRecognizer recognizer;
  private boolean running = false;
  private boolean restarting = false;
  private String phrase = "hera";

  @PluginMethod
  public void isAvailable(PluginCall call) {
    JSObject out = new JSObject();
    boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
    out.put("available", available);
    out.put("engine", available ? "android-speech-offline-preferred" : "none");
    call.resolve(out);
  }

  @PluginMethod
  public void start(PluginCall call) {
    String next = call.getString("phrase", "hera");
    if (next != null && !next.isEmpty()) phrase = next;

    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      requestPermissionForAlias("microphone", call, "onMicPermission");
      return;
    }

    beginListening();
    call.resolve();
  }

  @PermissionCallback
  private void onMicPermission(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      JSObject err = new JSObject();
      err.put("message", "Microphone permission denied");
      notifyListeners("error", err);
      call.reject("Microphone permission denied");
      return;
    }
    beginListening();
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    running = false;
    main.post(this::destroyRecognizer);
    call.resolve();
  }

  private void beginListening() {
    running = true;
    main.post(this::ensureRecognizer);
  }

  private void ensureRecognizer() {
    if (!running) return;
    if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
      JSObject err = new JSObject();
      err.put("message", "On-device speech recognizer is not available");
      notifyListeners("error", err);
      return;
    }
    if (recognizer == null) {
      recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
      recognizer.setRecognitionListener(listener);
    }
    startListeningLocked();
  }

  private void startListeningLocked() {
    if (!running || recognizer == null) return;
    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
    intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US.toString());
    intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
    try {
      recognizer.startListening(intent);
    } catch (Exception e) {
      Log.w(TAG, "startListening failed", e);
      scheduleRestart();
    }
  }

  private void scheduleRestart() {
    if (!running || restarting) return;
    restarting = true;
    main.postDelayed(() -> {
      restarting = false;
      if (running) startListeningLocked();
    }, 320);
  }

  private void destroyRecognizer() {
    if (recognizer != null) {
      try {
        recognizer.cancel();
        recognizer.destroy();
      } catch (Exception ignored) {
        /* already gone */
      }
      recognizer = null;
    }
  }

  private void handleHypothesis(@NonNull String text) {
    Matcher match = WAKE.matcher(text);
    if (!match.find()) return;
    String remainder = text.substring(match.end()).replaceFirst("^[,.!?\\s]+", "").trim();
    running = false;
    JSObject payload = new JSObject();
    payload.put("phrase", phrase);
    payload.put("remainder", remainder);
    notifyListeners("wake", payload);
    destroyRecognizer();
  }

  private final RecognitionListener listener = new RecognitionListener() {
    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}

    @Override
    public void onError(int error) {
      if (!running) return;
      if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
        JSObject err = new JSObject();
        err.put("message", "Microphone permission denied");
        notifyListeners("error", err);
        running = false;
        return;
      }
      scheduleRestart();
    }

    @Override
    public void onResults(Bundle results) {
      consume(results);
      if (running) scheduleRestart();
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
      consume(partialResults);
    }

    @Override
    public void onEvent(int eventType, Bundle params) {}

    private void consume(Bundle bundle) {
      if (!running || bundle == null) return;
      ArrayList<String> texts = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
      if (texts == null) return;
      for (String text : texts) {
        if (text != null) handleHypothesis(text);
      }
    }
  };

  @Override
  protected void handleOnPause() {
    super.handleOnPause();
    running = false;
    main.post(this::destroyRecognizer);
  }

  @Override
  protected void handleOnDestroy() {
    running = false;
    destroyRecognizer();
    super.handleOnDestroy();
  }
}
