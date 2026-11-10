---
title: "Reach it from your computer"
description: "Open fxbot as an app of its own on a Windows, Mac, or Linux computer, in Chrome, Edge, Safari, or Firefox: on the machine it runs on, or on any other computer with web pairing."
---

Open fxbot as an app of its own on a Windows, Mac, or Linux computer, in Chrome, Edge, Safari, or Firefox: on the machine it runs on, or on any other computer with web pairing. Installed, it has its own window and icon, without the browser's bars.

## On the machine fxbot runs on

Open `http://127.0.0.1:8787` in a browser there, then [install it](#install-it-as-an-app).

## On another computer

Web pairing opens your fxbot at [web.fxbot.sh](https://web.fxbot.sh), over a connection straight to it, away from home too. You need the **web-pairing** plugin: add it from **Plugins**.

1. On the computer, open web.fxbot.sh, [install it](#install-it-as-an-app), and open the app. Pair in the app, not in a private window: what a private window stores is gone when it closes.
2. On your fxbot, open **Settings** › **Web pairing**, and choose **Pair a device**. Use the machine itself, Tailscale, or an [SSH tunnel](/docs/how-to/reach-it-from-your-phone/#from-a-server-with-no-screen). It shows a code, such as `47-3816-0925`.
3. In the app, choose **Pair a device**, and type the code.
4. Both screens show six digits. Check they're the same, then choose **Approve** on your fxbot.

The app says **Paired**. Choose **Open**: your fxbot fills the window, with your bots, plugins, and settings.

A computer that's already paired can [pair this one](/docs/how-to/pair-another-device/) from anywhere. For other ways in, such as an SSH tunnel or Tailscale, see [Reach fxbot from other devices](/docs/how-to/reach-it/).

## Install it as an app

Install from whichever address you opened: `http://127.0.0.1:8787` on the machine, or web.fxbot.sh elsewhere.

- **Chrome,** on Windows, Mac, or Linux: choose **Install** at the right of the address bar. Or open the menu (**⋮**), then **Cast, save, and share** › **Install page as app**. At `http://127.0.0.1:8787`, fxbot's **Settings** › **General** has an **Install** button too.
- **Edge,** on Windows, Mac, or Linux: choose the install button at the right of the address bar. Or open **Settings and more** (**…**), then **More tools** › **Apps** › **Install this site as an app**. At `http://127.0.0.1:8787`, **Settings** › **General** has the **Install** button here too.
- **Safari,** on a Mac with macOS Sonoma 14 or later: choose **File** › **Add to Dock**, or **Share** › **Add to Dock**, then **Add**.
- **Firefox** runs fxbot in a tab, and doesn't install it as an app of its own. To keep it at hand, right-click its tab and choose **Pin Tab**.

Then open fxbot like any other app:

- **Windows:** from the Start menu. Right-click its icon in the taskbar, and choose **Pin to taskbar** to keep it there.
- **Mac:** from the Dock, Launchpad, or Spotlight.
- **Linux:** from your desktop's app menu.
