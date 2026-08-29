package com.example.watchmobile

import android.app.Activity
import android.os.Build
import android.view.WindowManager

/**
 * Asks for the fastest display mode that keeps the current resolution. Picking the
 * globally fastest mode can silently drop the panel to a lower resolution on phones
 * that expose 120Hz only at reduced size.
 */
fun Activity.requestPeakRefreshRate() {
    window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
    val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        display
    } else {
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay
    } ?: return

    val current = display.mode ?: return
    val best = display.supportedModes
        .filter {
            it.physicalWidth == current.physicalWidth &&
                it.physicalHeight == current.physicalHeight
        }
        .maxByOrNull { it.refreshRate }
        ?: return

    if (best.modeId == current.modeId && best.refreshRate <= current.refreshRate) return

    val params = window.attributes
    params.preferredDisplayModeId = best.modeId
    params.preferredRefreshRate = best.refreshRate
    window.attributes = params
}
