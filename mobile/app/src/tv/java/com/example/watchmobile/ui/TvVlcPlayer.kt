package com.example.watchmobile.ui

import android.net.Uri
import android.view.Gravity
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.watchmobile.data.WatchApi
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.util.VLCVideoLayout

@Composable
fun TvVlcPlayer(
    fileId: Long,
    title: String,
    api: WatchApi,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf("Starting VLC…") }
    var error by remember { mutableStateOf<String?>(null) }
    val url = remember(fileId) { api.streamUrl(fileId) }

    BackHandler(onBack = onBack)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        AndroidView(
            factory = { ctx ->
                val layout = VLCVideoLayout(ctx)
                layout.layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER,
                )
                val lib = LibVLC(
                    ctx,
                    arrayListOf(
                        "--aout=opensles",
                        "--network-caching=4000",
                        "--http-reconnect",
                        "--avcodec-hw=any",
                    ),
                )
                val vlc = MediaPlayer(lib)
                val held = VlcHold(lib, vlc)
                layout.tag = held
                layout.isFocusable = true
                layout.isFocusableInTouchMode = true
                layout.setOnKeyListener { _, keyCode, event ->
                    if (event.action != KeyEvent.ACTION_UP) return@setOnKeyListener false
                    when (keyCode) {
                        KeyEvent.KEYCODE_DPAD_CENTER,
                        KeyEvent.KEYCODE_BUTTON_A,
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                        -> {
                            if (vlc.isPlaying) vlc.pause() else vlc.play()
                            true
                        }
                        else -> false
                    }
                }
                vlc.setEventListener { event ->
                    when (event.type) {
                        MediaPlayer.Event.Opening -> status = "Opening…"
                        MediaPlayer.Event.Buffering -> {
                            val pct = event.buffering
                            status = if (pct in 0f..99.5f) "Loading ${pct.toInt()}%" else ""
                        }
                        MediaPlayer.Event.Playing -> status = ""
                        MediaPlayer.Event.EncounteredError -> {
                            error = "VLC could not play this file"
                            status = ""
                        }
                    }
                }
                val media = Media(lib, Uri.parse(url))
                media.setHWDecoderEnabled(true, true)
                vlc.media = media
                media.release()
                layout.post {
                    vlc.attachViews(layout, null, false, true)
                    vlc.play()
                    layout.requestFocus()
                }
                layout
            },
            modifier = Modifier.fillMaxSize(),
            onRelease = { layout ->
                val held = layout.tag as? VlcHold
                try {
                    held?.player?.stop()
                    held?.player?.detachViews()
                } catch (_: Exception) {
                }
                held?.player?.release()
                held?.lib?.release()
            },
        )
        if (error != null) {
            Text(
                error!!,
                color = Color.White,
                modifier = Modifier.align(Alignment.Center).padding(32.dp),
            )
        } else if (status.isNotBlank()) {
            Text(
                status,
                color = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }
}

private class VlcHold(val lib: LibVLC, val player: MediaPlayer)
