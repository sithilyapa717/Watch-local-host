package com.example.watchmobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.example.watchmobile.data.CompletenessResponse
import com.example.watchmobile.data.WatchApi

@Composable
fun ShowDetailScreen(
    showId: Long,
    api: WatchApi,
    refreshTick: Int,
    onBack: () -> Unit,
    onPlay: (Long, String) -> Unit,
) {
    var data by remember(showId) { mutableStateOf(api.peekCompleteness(showId)) }
    var seasonIndex by remember(showId) { mutableIntStateOf(0) }
    var seasonReady by remember(showId) { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(showId, refreshTick) {
        if (data != null && refreshTick == 0) return@LaunchedEffect
        try {
            val loaded = api.completeness(showId, force = true)
            data = loaded
            if (!seasonReady) {
                val firstOwned = loaded.completeness.seasons.indexOfFirst { it.ownedCount > 0 }
                if (firstOwned >= 0) seasonIndex = firstOwned
                seasonReady = true
            }
            error = null
        } catch (e: Exception) {
            if (data == null) error = e.message
        }
    }

    val completeness = data?.completeness
    if (data == null && error == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        ScreenHeader(
            title = completeness?.title.orEmpty(),
            navIcon = Icons.AutoMirrored.Filled.ArrowBack,
            navDescription = "Back",
            onNav = onBack,
        )
        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(20.dp))
        }
        if (completeness != null) {
            val seasons = completeness.seasons
            if (seasons.isNotEmpty()) {
                val safeIndex = seasonIndex.coerceIn(0, seasons.lastIndex)
                val season = seasons[safeIndex]
                Row(
                    modifier = Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    seasons.forEachIndexed { i, s ->
                        val selected = i == safeIndex
                        Text(
                            "S${s.seasonNumber}",
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (selected) MaterialTheme.colorScheme.surfaceVariant
                                    else MaterialTheme.colorScheme.background,
                                )
                                .watchClickable { seasonIndex = i }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            color = if (selected) {
                                MaterialTheme.colorScheme.onSurface
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            style = MaterialTheme.typography.labelLarge,
                        )
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    itemsIndexed(
                        season.episodes,
                        key = { epIndex, ep ->
                            "ep-${season.seasonNumber}-${ep.episodeNumber}-$epIndex-${ep.fileId}"
                        },
                        contentType = { _, _ -> "episode" },
                    ) { _, ep ->
                        val playable = ep.fileId != null && ep.status != "missing"
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .watchClickable(enabled = playable) {
                                    val id = ep.fileId ?: return@watchClickable
                                    onPlay(id, ep.name)
                                }
                                .then(if (playable) Modifier else Modifier.alpha(0.4f))
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "E${ep.episodeNumber.toString().padStart(2, '0')}",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelLarge,
                            )
                            Text(
                                ep.name,
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1,
                            )
                            val meta = when {
                                !playable -> null
                                ep.status == "owned_watched" -> "Watched"
                                ep.status == "owned_in_progress" -> "${ep.progressPct.toInt()}%"
                                else -> null
                            }
                            if (meta != null) {
                                Text(
                                    meta,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
