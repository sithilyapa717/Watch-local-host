package com.example.watchmobile.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.os.Build
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ScreenLockRotation
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.ui.PlayerView
import com.example.watchmobile.BuildConfig
import com.example.watchmobile.R
import com.example.watchmobile.data.WatchApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    fileId: Long,
    title: String,
    api: WatchApi,
    onBack: () -> Unit,
) {
    if (BuildConfig.IS_TV) {
        TvVlcPlayer(fileId = fileId, title = title, api = api, onBack = onBack)
        return
    }
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val scope = rememberCoroutineScope()
    var leaving by remember { mutableStateOf(false) }
    var chromeVisible by remember { mutableStateOf(!BuildConfig.IS_TV) }
    var orientationLocked by remember { mutableStateOf(false) }
    var playerError by remember { mutableStateOf<String?>(null) }
    var playerStatus by remember { mutableStateOf(if (BuildConfig.IS_TV) "Starting…" else "") }
    val leaveVisibility = animateFloatAsState(
        targetValue = if (leaving) 0f else 1f,
        animationSpec = tween(durationMillis = 280),
        label = "playerFade",
    )
    val chromeAlpha = animateFloatAsState(
        targetValue = if (chromeVisible && !leaving) 1f else 0f,
        animationSpec = tween(durationMillis = 180),
        label = "chromeFade",
    )
    val player = remember(fileId) {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent("Watch/1.2.1")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(20_000)
            .setReadTimeoutMs(60_000)
        val extractors = DefaultExtractorsFactory().setConstantBitrateSeekingEnabled(true)
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(5_000, 20_000, 1_500, 3_000)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        val tracks = DefaultTrackSelector(context)
        val renderers = DefaultRenderersFactory(context)
            .setEnableDecoderFallback(true)
            .setMediaCodecSelector { mimeType, requiresSecure, requiresTunneling ->
                val infos = try {
                    MediaCodecUtil.getDecoderInfos(mimeType, requiresSecure, requiresTunneling)
                } catch (_: Exception) {
                    emptyList()
                }
                if (mimeType.contains("hevc", ignoreCase = true) ||
                    mimeType.contains("dolby", ignoreCase = true)
                ) {
                    infos.sortedByDescending { it.softwareOnly }
                } else {
                    infos
                }
            }
        ExoPlayer.Builder(context)
            .setRenderersFactory(renderers)
            .setTrackSelector(tracks)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(DefaultMediaSourceFactory(http, extractors))
            .build()
            .apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(),
                    true,
                )
                setWakeMode(C.WAKE_MODE_NETWORK)
                addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        playerError = listOfNotNull(
                            error.errorCodeName,
                            error.localizedMessage,
                        ).joinToString(" — ")
                        playerStatus = ""
                    }

                    override fun onPlaybackStateChanged(state: Int) {
                        playerStatus = when (state) {
                            Player.STATE_BUFFERING -> "Loading…"
                            Player.STATE_ENDED -> "Ended"
                            Player.STATE_IDLE -> "Idle"
                            else -> ""
                        }
                    }
                })
                setMediaItem(MediaItem.fromUri(api.streamUrl(fileId)))
                prepare()
                playWhenReady = true
            }
    }

    DisposableEffect(activity) {
        val host = activity
        host?.requestedOrientation = if (BuildConfig.IS_TV) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
        if (!BuildConfig.IS_TV) host?.setPlayerSystemBarsHidden(true)
        val focusListener = ViewTreeObserver.OnWindowFocusChangeListener { hasFocus ->
            if (hasFocus && !BuildConfig.IS_TV) host?.setPlayerSystemBarsHidden(true)
        }
        host?.window?.decorView?.viewTreeObserver?.addOnWindowFocusChangeListener(focusListener)
        onDispose {
            host?.window?.decorView?.viewTreeObserver?.removeOnWindowFocusChangeListener(focusListener)
            if (!BuildConfig.IS_TV) host?.setPlayerSystemBarsHidden(false)
            host?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    LaunchedEffect(chromeVisible, leaving) {
        if (!BuildConfig.IS_TV && !leaving) activity?.setPlayerSystemBarsHidden(true)
    }

    fun startLeave() {
        if (leaving) return
        player.playWhenReady = false
        player.pause()
        leaving = true
    }

    fun toggleOrientationLock() {
        val host = activity ?: return
        orientationLocked = !orientationLocked
        host.requestedOrientation = if (orientationLocked) {
            ActivityInfo.SCREEN_ORIENTATION_LOCKED
        } else {
            ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
    }

    BackHandler(onBack = ::startLeave)

    LaunchedEffect(leaving) {
        if (leaving) {
            delay(300)
            onBack()
        }
    }

    DisposableEffect(player) {
        val job: Job = scope.launch {
            while (isActive) {
                delay(5000)
                val duration = player.duration
                val position = player.currentPosition
                if (duration > 0) {
                    try {
                        api.saveProgress(fileId, position / 1000.0, duration / 1000.0)
                    } catch (_: Exception) {
                    }
                }
            }
        }
        onDispose {
            job.cancel()
            val duration = player.duration
            val position = player.currentPosition
            if (duration > 0) {
                scope.launch(Dispatchers.IO) {
                    try {
                        api.saveProgress(fileId, position / 1000.0, duration / 1000.0)
                    } catch (_: Exception) {
                    }
                }
            }
            player.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .then(
                if (BuildConfig.IS_TV) Modifier
                else Modifier.graphicsLayer { alpha = leaveVisibility.value }
            ),
    ) {
        AndroidView(
            factory = { ctx ->
                (LayoutInflater.from(ctx).inflate(R.layout.watch_player_view, null) as PlayerView).apply {
                    this.player = player
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    keepScreenOn = true
                    useController = true
                    controllerAutoShow = true
                    controllerShowTimeoutMs = if (BuildConfig.IS_TV) 5_000 else 4_000
                    isFocusable = true
                    isFocusableInTouchMode = true
                    setShowNextButton(false)
                    setShowPreviousButton(false)
                    post { requestFocus() }
                    setControllerVisibilityListener(
                        PlayerView.ControllerVisibilityListener { visibility ->
                            chromeVisible = visibility == View.VISIBLE
                        },
                    )
                }
            },
            modifier = Modifier.fillMaxSize(),
            update = { it.player = player },
        )
        if (playerError != null) {
            Text(
                playerError!!,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(32.dp),
            )
        } else if (playerStatus.isNotBlank()) {
            Text(
                playerStatus,
                color = Color.White.copy(alpha = 0.8f),
                modifier = Modifier.align(Alignment.Center),
            )
        }
        if (!BuildConfig.IS_TV) {
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.displayCutout)
                .padding(start = 4.dp, top = 4.dp, end = 4.dp)
                .graphicsLayer { alpha = chromeAlpha.value },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = ::startLeave, enabled = chromeVisible, modifier = Modifier.tvFocusRing()) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text(
                title,
                color = Color.White.copy(alpha = 0.9f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (!BuildConfig.IS_TV) {
            IconButton(onClick = ::toggleOrientationLock, enabled = chromeVisible, modifier = Modifier.tvFocusRing()) {
                Icon(
                    imageVector = if (orientationLocked) {
                        Icons.Filled.ScreenLockRotation
                    } else {
                        Icons.Filled.ScreenRotation
                    },
                    contentDescription = if (orientationLocked) "Unlock orientation" else "Lock orientation",
                    tint = Color.White,
                )
            }
            }
        }
        }
    }
}

private fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

private fun Activity.setPlayerSystemBarsHidden(hidden: Boolean) {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val params = window.attributes
        params.layoutInDisplayCutoutMode =
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        window.attributes = params
    }
    val insets = WindowInsetsControllerCompat(window, window.decorView)
    if (hidden) {
        insets.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insets.hide(WindowInsetsCompat.Type.systemBars())
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
    } else {
        insets.show(WindowInsetsCompat.Type.systemBars())
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }
}
