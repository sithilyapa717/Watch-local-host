package com.example.watchmobile.ui

import android.app.Activity
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import com.example.watchmobile.BuildConfig

val LocalIsTv = staticCompositionLocalOf { BuildConfig.IS_TV }

private val TvFocus = Color(0xFF8B5CF6)

fun Modifier.watchClickable(
    enabled: Boolean = true,
    shape: Shape = RoundedCornerShape(10.dp),
    onClick: () -> Unit,
): Modifier = composed {
    val isTv = LocalIsTv.current
    var focused by remember { mutableStateOf(false) }
    this
        .onFocusChanged { focused = it.isFocused }
        .then(
            if (isTv && focused) Modifier.border(3.dp, TvFocus, shape)
            else Modifier
        )
        .clickable(enabled = enabled, onClick = onClick)
        .onPreviewKeyEvent { event ->
            if (!isTv || !enabled || event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
            when (event.key) {
                Key.ButtonA, Key.ButtonX -> {
                    onClick()
                    true
                }
                else -> false
            }
        }
}

fun Modifier.tvFocusRing(shape: Shape = RectangleShape): Modifier = composed {
    val isTv = LocalIsTv.current
    if (!isTv) return@composed this
    var focused by remember { mutableStateOf(false) }
    onFocusChanged { focused = it.isFocused }
        .then(if (focused) Modifier.border(2.dp, TvFocus, shape) else Modifier)
}

/** Turns a gamepad stick / hat into D-pad key events so Compose focus can move. */
class StickDpadMapper {
    private var lastX = 0
    private var lastY = 0
    private var lastEmit = 0L

    fun dispatch(activity: Activity, event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_MOVE) return false
        val joystick = event.isFromSource(InputDevice.SOURCE_JOYSTICK) ||
            event.isFromSource(InputDevice.SOURCE_GAMEPAD) ||
            event.isFromSource(InputDevice.SOURCE_DPAD)
        if (!joystick) return false
        // Only the D-pad hat. Analog stick drift was why focus felt like you had to wiggle.
        val x = event.getAxisValue(MotionEvent.AXIS_HAT_X)
        val y = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
        val dx = when {
            x > 0.55f -> 1
            x < -0.55f -> -1
            else -> 0
        }
        val dy = when {
            y > 0.55f -> 1
            y < -0.55f -> -1
            else -> 0
        }
        if (dx == 0 && dy == 0) {
            lastX = 0
            lastY = 0
            return false
        }
        val now = SystemClock.uptimeMillis()
        val same = dx == lastX && dy == lastY
        if (same && now - lastEmit < 260L) return true
        lastX = dx
        lastY = dy
        lastEmit = now
        val code = when {
            dy < 0 -> KeyEvent.KEYCODE_DPAD_UP
            dy > 0 -> KeyEvent.KEYCODE_DPAD_DOWN
            dx < 0 -> KeyEvent.KEYCODE_DPAD_LEFT
            else -> KeyEvent.KEYCODE_DPAD_RIGHT
        }
        activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
        return true
    }
}
