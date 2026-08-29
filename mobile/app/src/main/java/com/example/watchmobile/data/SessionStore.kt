package com.example.watchmobile.data

import android.content.Context
import androidx.compose.runtime.Stable

/**
 * Values are mirrored in memory because getters are hit from composition
 * (every poster/stream URL) and SharedPreferences reads are lock-guarded.
 */
@Stable
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("watch_mobile", Context.MODE_PRIVATE)

    private var cachedHost = prefs.getString("host", "127.0.0.1") ?: "127.0.0.1"
    private var cachedPort = prefs.getString("port", "8742") ?: "8742"
    private var cachedToken = prefs.getString("token", "") ?: ""
    private var cachedPaired = prefs.getBoolean("paired", false)

    var host: String
        get() = cachedHost
        set(value) {
            cachedHost = value.trim()
            baseUrlCache = null
            prefs.edit().putString("host", cachedHost).apply()
        }

    var port: String
        get() = cachedPort
        set(value) {
            cachedPort = value.trim()
            baseUrlCache = null
            prefs.edit().putString("port", cachedPort).apply()
        }

    var token: String
        get() = cachedToken
        set(value) {
            cachedToken = value.trim()
            prefs.edit().putString("token", cachedToken).apply()
        }

    var isPaired: Boolean
        get() = cachedPaired && cachedToken.length == 6 && cachedToken.all { it.isDigit() }
        set(value) {
            cachedPaired = value
            prefs.edit().putBoolean("paired", value).apply()
        }

    private var baseUrlCache: String? = null

    val baseUrl: String
        get() = baseUrlCache ?: "http://$cachedHost:$cachedPort".also { baseUrlCache = it }

    fun savePairing(host: String, port: String, token: String) {
        cachedHost = host.trim()
        cachedPort = port.trim()
        cachedToken = token.trim()
        cachedPaired = true
        baseUrlCache = null
        prefs.edit()
            .putString("host", cachedHost)
            .putString("port", cachedPort)
            .putString("token", cachedToken)
            .putBoolean("paired", true)
            .apply()
    }

    fun clearPairing() {
        cachedPaired = false
        prefs.edit().putBoolean("paired", false).apply()
    }
}
