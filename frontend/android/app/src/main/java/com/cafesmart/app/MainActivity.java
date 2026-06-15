package com.cafesmart.app;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.util.Log;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.setWebChromeClient(new CafeSmartWebChromeClient(getBridge()));
    }

    private static class CafeSmartWebChromeClient extends BridgeWebChromeClient {
        private final Bridge bridge;
        private Dialog popupDialog;
        private WebView popupWebView;

        CafeSmartWebChromeClient(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

        @Override
        public boolean onCreateWindow(
            WebView view,
            boolean isDialog,
            boolean isUserGesture,
            Message resultMsg
        ) {
            popupWebView = new WebView(view.getContext());
            WebSettings popupSettings = popupWebView.getSettings();
            popupSettings.setJavaScriptEnabled(true);
            popupSettings.setDomStorageEnabled(true);
            popupSettings.setSupportMultipleWindows(true);
            popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);

            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true);

            popupWebView.setWebChromeClient(this);

            popupDialog = new Dialog(bridge.getActivity());
            popupDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            popupDialog.setContentView(popupWebView);
            popupDialog.setOnDismissListener(dialog -> {
                if (popupWebView != null) {
                    popupWebView.destroy();
                    popupWebView = null;
                }
            });
            popupDialog.show();

            Window window = popupDialog.getWindow();
            if (window != null) {
                window.setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
            }

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popupWebView);
            resultMsg.sendToTarget();

            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            if (consoleMessage != null && consoleMessage.message().contains("CafeSmart")) {
                Log.i("CafeSmartWebView", consoleMessage.message());
            }
            return super.onConsoleMessage(consoleMessage);
        }

        @Override
        public void onCloseWindow(WebView window) {
            super.onCloseWindow(window);

            if (popupDialog != null && popupDialog.isShowing()) {
                popupDialog.dismiss();
            }
            popupDialog = null;
            popupWebView = null;
        }
    }
}
