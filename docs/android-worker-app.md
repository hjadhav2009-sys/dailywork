# DailyWork Worker Android App

DailyWork Worker is a lightweight Android wrapper for workers and packers. The PC-running DailyWork web app remains the main server and source of business data. The phone stores only the local PC server URL, such as `http://192.168.1.20:3000`.

The Android app does not add public hosting, scraping, full catalog image downloads, Meesho credential storage, owner credential storage, or worker password storage.

## What It Opens

- Picker mode: `/picker`
- SKU search: `/picker/search-sku`
- Packer mode: `/packing`
- Scanner mode: native camera scan, then `/packing/<AWB>`
- Problems: `/problems`
- Logout: existing DailyWork logout/session-ended flow

## Build APK On Windows

Install Android Studio first, including Android SDK 35 and a JDK 17 runtime. Then either open `app/android-worker` in Android Studio and use **Build > Build APK(s)**, or run this from PowerShell:

```powershell
cd E:\dailywork\app\android-worker
gradle :app:assembleDebug
```

The debug APK will be created at:

```text
E:\dailywork\app\android-worker\app\build\outputs\apk\debug\app-debug.apk
```

For release signing, use Android Studio's **Generate Signed Bundle / APK** flow and keep signing keys outside GitHub.

## Install On Worker Phones

1. Copy the APK to the Android phone.
2. Open the APK on the phone.
3. Allow installation from the file manager when Android asks.
4. Open **DailyWork Worker**.
5. Enter the PC server address and tap **Connect**.

## Find The PC IP Address

On the PC, run:

```powershell
ipconfig
```

Use the IPv4 address for the connected Wi-Fi or hotspot adapter. The address usually looks like `192.168.x.x`.

Start DailyWork so other local devices can reach it:

```powershell
cd E:\dailywork\app
$env:DATABASE_URL="file:./dev.db"
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Then use this on the phone:

```text
http://<PC IPv4 address>:3000
```

Example:

```text
http://192.168.1.20:3000
```

## Same Wi-Fi Or PC Hotspot

The phone and PC must be on the same local network. Use one of these setups:

- Connect both phone and PC to the same Wi-Fi router.
- Turn on PC mobile hotspot and connect the phone to that hotspot.
- Use a local LAN IP that the phone can reach.

Public hosting and HTTPS are not required for scanning because the camera scanner is native Android code, not browser camera code.

## Test The Scanner

1. Open **DailyWork Worker**.
2. Connect to the PC server.
3. Tap **Scan AWB**.
4. Grant camera permission.
5. Scan an AWB barcode.
6. The app opens `/packing/<AWB>` in the existing packing flow.

If the barcode is damaged or camera permission is denied, tap **Manual AWB** and enter the AWB.

## Troubleshoot Camera Permission

- Open Android Settings.
- Go to Apps > DailyWork Worker > Permissions.
- Allow Camera.
- Reopen the app and tap **Scan AWB** again.

If camera access is still denied, use **Manual AWB**. The browser-based workflow remains available in the normal mobile web app.

## Troubleshoot PC Unreachable

Check these in order:

1. The PC and phone are on the same Wi-Fi or phone is connected to the PC hotspot.
2. DailyWork is running on the PC.
3. DailyWork was started with `--hostname 0.0.0.0 --port 3000`.
4. The server URL in the phone app includes the correct PC IPv4 address and port.
5. Windows Firewall allows Node.js on private networks.
6. Try opening the same URL in the phone browser.

The app intentionally expects a local URL like `http://192.168.x.x:3000`; it is not designed to require public hosting.

## Update APK Later

1. Pull the latest repository changes on the PC.
2. Rebuild the APK with `gradle :app:assembleDebug` or Android Studio.
3. Install the new APK on phones.
4. The saved PC server URL remains on the phone unless the app is uninstalled or app storage is cleared.

## Safety Notes

- The Excel catalog and business data stay on the PC/server app.
- The phone stores only the optional saved server URL.
- DailyWork login and logout continue to be handled by the existing web app.
- The Android wrapper does not store Meesho credentials.
- The Android wrapper does not scrape Meesho.
- The Android wrapper does not download catalog images in bulk.
