package com.dailywork.worker;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final int CAMERA_PERMISSION_REQUEST = 4411;
    private static final String PREFS = "dailywork-worker";
    private static final String SERVER_URL_KEY = "server-url";

    private SharedPreferences prefs;
    private String serverUrl = "";
    private WebView webView;
    private TextView statusView;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        serverUrl = prefs.getString(SERVER_URL_KEY, "");

        if (serverUrl == null || serverUrl.isEmpty()) {
            showSetupScreen();
        } else {
            showWorkerShell();
            loadRoute(DailyWorkRoutes.routeForMode("packer"));
        }
    }

    private void showSetupScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(32), dp(24), dp(24));
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.rgb(248, 250, 252));

        TextView title = text("DailyWork Worker", 30, true);
        TextView subtitle = text("Connect to the DailyWork PC server on local Wi-Fi.", 16, false);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(10), 0, dp(18));

        EditText serverInput = new EditText(this);
        serverInput.setSingleLine(true);
        serverInput.setHint("http://192.168.x.x:3000");
        serverInput.setText(serverUrl);
        serverInput.setTextSize(18);
        serverInput.setPadding(dp(16), dp(14), dp(16), dp(14));
        root.addView(title, matchWrap());
        root.addView(subtitle, matchWrap());
        root.addView(serverInput, matchWrap());

        Button connect = primaryButton("Connect");
        Button test = secondaryButton("Test Connection");
        TextView help = text("Phone and PC must be on same Wi-Fi or phone must connect to PC hotspot.", 15, false);
        help.setPadding(0, dp(16), 0, 0);

        connect.setOnClickListener(v -> saveServerAndOpen(serverInput.getText().toString()));
        test.setOnClickListener(v -> testConnection(serverInput.getText().toString()));

        root.addView(connect, buttonParams());
        root.addView(test, buttonParams());
        root.addView(help, matchWrap());
        statusView = text("Not connected", 15, true);
        statusView.setPadding(0, dp(16), 0, 0);
        root.addView(statusView, matchWrap());

        setContentView(root);
    }

    private void showWorkerShell() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(14), dp(12), dp(14), dp(8));
        header.setBackgroundColor(Color.rgb(255, 255, 255));

        TextView title = text("DailyWork Worker", 20, true);
        statusView = text("Connected to " + serverUrl, 13, false);
        statusView.setSingleLine(false);
        header.addView(title, matchWrap());
        header.addView(statusView, matchWrap());

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        progressBar.setVisibility(View.GONE);
        header.addView(progressBar, matchWrap());
        root.addView(header, matchWrap());

        webView = new WebView(this);
        configureWebView();
        root.addView(webView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        ScrollView actionsScroll = new ScrollView(this);
        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setPadding(dp(12), dp(10), dp(12), dp(12));
        actions.setBackgroundColor(Color.rgb(248, 250, 252));

        LinearLayout rowOne = actionRow();
        rowOne.addView(navButton("Picker", "picker"), equalButtonParams());
        rowOne.addView(navButton("SKU Search", "sku-search"), equalButtonParams());
        rowOne.addView(navButton("Packer", "packer"), equalButtonParams());

        LinearLayout rowTwo = actionRow();
        Button scan = primaryButton("Scan AWB");
        scan.setOnClickListener(v -> openScanner());
        rowTwo.addView(scan, equalButtonParams());
        rowTwo.addView(navButton("Problems", "problems"), equalButtonParams());
        rowTwo.addView(navButton("Logout", "logout"), equalButtonParams());

        LinearLayout rowThree = actionRow();
        Button server = secondaryButton("Change Server");
        server.setOnClickListener(v -> showSetupScreen());
        Button manual = secondaryButton("Manual AWB");
        manual.setOnClickListener(v -> showManualAwbDialog());
        rowThree.addView(server, equalButtonParams());
        rowThree.addView(manual, equalButtonParams());

        actions.addView(rowOne, matchWrap());
        actions.addView(rowTwo, matchWrap());
        actions.addView(rowThree, matchWrap());
        actionsScroll.addView(actions);
        root.addView(actionsScroll, matchWrap());

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                setStatus("Loaded " + Uri.parse(url).getPath());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    setStatus("PC server unreachable. Check Wi-Fi, hotspot, IP address, and port 3000.");
                }
            }
        });
    }

    private void saveServerAndOpen(String value) {
        try {
            serverUrl = DailyWorkRoutes.normalizeServerUrl(value);
            prefs.edit().putString(SERVER_URL_KEY, serverUrl).apply();
            showWorkerShell();
            loadRoute(DailyWorkRoutes.routeForMode("packer"));
            testConnection(serverUrl);
        } catch (IllegalArgumentException error) {
            setStatus(error.getMessage());
        }
    }

    private void loadRoute(String route) {
        try {
            String url = DailyWorkRoutes.absoluteUrl(serverUrl, route);
            setStatus("Opening " + route);
            webView.loadUrl(url);
        } catch (IllegalArgumentException error) {
            setStatus(error.getMessage());
            showSetupScreen();
        }
    }

    private Button navButton(String label, String mode) {
        Button button = secondaryButton(label);
        button.setOnClickListener(v -> loadRoute(DailyWorkRoutes.routeForMode(mode)));
        return button;
    }

    private void testConnection(String value) {
        String target;
        try {
            target = DailyWorkRoutes.absoluteUrl(value, "/login");
            setStatus("Testing PC server...");
        } catch (IllegalArgumentException error) {
            setStatus(error.getMessage());
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(target).openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);
                connection.setRequestMethod("GET");
                int status = connection.getResponseCode();
                runOnUiThread(() -> setStatus(status >= 200 && status < 500
                        ? "PC server is reachable."
                        : "PC server responded with HTTP " + status + "."));
            } catch (IOException error) {
                runOnUiThread(() -> setStatus("PC server is unreachable. Check Wi-Fi, hotspot, IP address, and port 3000."));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private void openScanner() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
            return;
        }

        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setPrompt("Scan AWB barcode");
        integrator.setBeepEnabled(true);
        integrator.setOrientationLocked(true);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES);
        integrator.initiateScan();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                showManualAwbDialog();
            } else {
                openAwb(result.getContents());
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            openScanner();
            return;
        }
        setStatus("Camera permission denied. Use manual AWB entry.");
        showManualAwbDialog();
    }

    private void showManualAwbDialog() {
        EditText input = new EditText(this);
        input.setHint("Enter AWB");
        input.setSingleLine(true);
        input.setTextSize(20);
        input.setPadding(dp(12), dp(12), dp(12), dp(12));

        new AlertDialog.Builder(this)
                .setTitle("Manual AWB")
                .setMessage("Use this if the barcode is damaged or camera permission is denied.")
                .setView(input)
                .setPositiveButton("Open", (dialog, which) -> openAwb(input.getText().toString()))
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void openAwb(String value) {
        try {
            loadRoute(DailyWorkRoutes.packingRoute(value));
        } catch (IllegalArgumentException error) {
            setStatus(error.getMessage());
            showManualAwbDialog();
        }
    }

    private void setStatus(String message) {
        if (statusView != null) {
            statusView.setText(message);
        }
    }

    private TextView text(String value, int sizeSp, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sizeSp);
        text.setTextColor(Color.rgb(17, 24, 39));
        text.setGravity(Gravity.CENTER_HORIZONTAL);
        if (bold) {
            text.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        }
        return text;
    }

    private Button primaryButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextSize(16);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setBackgroundColor(Color.rgb(139, 30, 90));
        return button;
    }

    private Button secondaryButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextSize(15);
        button.setTextColor(Color.rgb(17, 24, 39));
        button.setAllCaps(false);
        button.setBackgroundColor(Color.rgb(229, 231, 235));
        return button;
    }

    private LinearLayout actionRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        return row;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(12), 0, 0);
        return params;
    }

    private LinearLayout.LayoutParams equalButtonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(52), 1f);
        params.setMargins(dp(4), dp(4), dp(4), dp(4));
        return params;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
