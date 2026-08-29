package com.example.watchmobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import com.example.watchmobile.BuildConfig
import com.example.watchmobile.ui.LocalIsTv

private val WatchColors = darkColorScheme(
    primary = Color(0xFF8B5CF6),
    onPrimary = Color.White,
    background = Color(0xFF09090B),
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF18181B),
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF27272A),
    onSurfaceVariant = Color(0xFFA1A1AA),
    secondary = Color(0xFF14B8A6),
    error = Color(0xFFF87171),
)

@Composable
fun WatchTheme(content: @Composable () -> Unit) {
    val isTv = BuildConfig.IS_TV
    CompositionLocalProvider(LocalIsTv provides isTv) {
        MaterialTheme(
            colorScheme = WatchColors,
            typography = if (isTv) WatchTvTypography else WatchTypography,
            content = content,
        )
    }
}
