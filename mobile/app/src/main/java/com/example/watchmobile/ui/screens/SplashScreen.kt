package com.example.watchmobile.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.example.watchmobile.BuildConfig

private val Accent = Color(0xFF8B5CF6)
private val Backdrop = Color(0xFF09090B)

/**
 * Every animated value here is read inside a `graphicsLayer`/draw lambda rather than
 * during composition, so the intro runs entirely on the render thread instead of
 * recomposing and re-laying out the whole tree on every one of 120 frames per second.
 */
@Composable
fun SplashScreen(
    holding: Boolean,
    status: String,
    showChangePc: Boolean,
    onIntroFinished: () -> Unit,
    onChangePc: () -> Unit,
) {
    if (BuildConfig.IS_TV) {
        TvSplashScreen(
            holding = holding,
            status = status,
            showChangePc = showChangePc,
            onIntroFinished = onIntroFinished,
            onChangePc = onChangePc,
        )
        return
    }
    val ring = remember { Animatable(0f) }
    val glow = remember { Animatable(0f) }
    val title = remember { Animatable(0f) }
    val bar = remember { Animatable(0f) }
    val holdingState = rememberUpdatedState(holding)
    val transition = rememberInfiniteTransition(label = "hold")
    val spin = transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "spin",
    )
    val breathe = transition.animateFloat(
        initialValue = 0.72f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "breathe",
    )
    val glowBrush = remember {
        Brush.radialGradient(colors = listOf(Accent.copy(alpha = 0.28f), Color.Transparent))
    }

    LaunchedEffect(Unit) {
        launch { glow.animateTo(1f, tween(700)) }
        launch { ring.animateTo(1f, tween(1100)) }
        launch {
            delay(280)
            title.animateTo(1f, tween(700))
        }
        launch {
            delay(520)
            bar.animateTo(1f, tween(500))
        }
        delay(1500)
        onIntroFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Backdrop),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            modifier = Modifier
                .size(280.dp)
                .graphicsLayer { alpha = glow.value * breathe.value },
        ) {
            drawCircle(brush = glowBrush, radius = size.minDimension * 0.55f)
        }
        Canvas(modifier = Modifier.size(168.dp)) {
            val stroke = 4.dp.toPx()
            val inset = stroke / 2
            val progress = ring.value
            rotate(if (holdingState.value) spin.value else -40f + progress * 40f) {
                drawArc(
                    color = Accent.copy(alpha = 0.25f + 0.55f * progress),
                    startAngle = -90f,
                    sweepAngle = 280f * progress,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = Size(size.width - stroke, size.height - stroke),
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
        }
        Text(
            "WATCH",
            color = Color.White,
            fontSize = 34.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 10.sp,
            modifier = Modifier.graphicsLayer {
                alpha = title.value
                translationY = (1f - title.value) * 18.dp.toPx()
            },
        )
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = 42.dp)
                .width(72.dp)
                .height(2.dp)
                .graphicsLayer {
                    scaleX = bar.value
                    transformOrigin = TransformOrigin(0.5f, 0.5f)
                }
                .background(Accent.copy(alpha = 0.9f)),
        )
        if (holding) {
            Text(
                status,
                color = Color.White.copy(alpha = 0.45f),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 96.dp)
                    .graphicsLayer { alpha = breathe.value },
            )
        }
        if (showChangePc) {
            TextButton(
                onClick = onChangePc,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 40.dp),
            ) {
                Text("Use a different PC")
            }
        }
    }
}

@Composable
private fun TvSplashScreen(
    holding: Boolean,
    status: String,
    showChangePc: Boolean,
    onIntroFinished: () -> Unit,
    onChangePc: () -> Unit,
) {
    LaunchedEffect(Unit) {
        delay(900)
        onIntroFinished()
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Backdrop),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "WATCH",
            color = Color.White,
            fontSize = 34.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 10.sp,
        )
        if (holding && status.isNotBlank()) {
            Text(
                status,
                color = Color.White.copy(alpha = 0.55f),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 96.dp),
            )
        }
        if (showChangePc) {
            TextButton(
                onClick = onChangePc,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 40.dp),
            ) {
                Text("Use a different PC")
            }
        }
    }
}
