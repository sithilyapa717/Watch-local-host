package com.example.watchmobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import com.example.watchmobile.data.HomePayload
import com.example.watchmobile.data.WatchApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    api: WatchApi,
    refreshTick: Int,
    onOpenLibrary: (String) -> Unit,
    onOpenShow: (Long, String) -> Unit,
    onPlay: (Long, String) -> Unit,
    onOpenMenu: () -> Unit,
    onSearch: () -> Unit,
) {
    var home by remember { mutableStateOf(api.cachedHome) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(api.cachedHome == null) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun reload(showSpinner: Boolean) {
        if (showSpinner && home == null) loading = true
        else refreshing = true
        try {
            home = api.home()
            error = null
        } catch (e: Exception) {
            if (home == null) error = e.message
        } finally {
            loading = false
            refreshing = false
        }
    }

    LaunchedEffect(refreshTick) {
        reload(showSpinner = home == null)
    }

    val isTv = LocalIsTv.current
    val posterWidth = if (isTv) 168.dp else 118.dp
    val continueWidth = if (isTv) 140.dp else 96.dp
    val firstTile = remember { FocusRequester() }
    val firstKey = remember(home) {
        val data = home ?: return@remember ""
        when {
            data.continueWatching.isNotEmpty() -> "cw-${data.continueWatching.first().fileId}"
            data.startAnime.isNotEmpty() -> "anime-${data.startAnime.first().id}"
            data.startTv.isNotEmpty() -> "tv-${data.startTv.first().id}"
            data.movies.isNotEmpty() -> "movie-${data.movies.first().id}"
            else -> ""
        }
    }

    LaunchedEffect(firstKey, isTv) {
        if (!isTv || firstKey.isEmpty()) return@LaunchedEffect
        delay(160)
        runCatching { firstTile.requestFocus() }
    }

    if (loading && home == null) {
        Box(Modifier.fillMaxSize())
        return
    }

    val content: @Composable () -> Unit = {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 28.dp),
        ) {
            ScreenHeader(
                title = "Home",
                navIcon = Icons.Filled.Menu,
                navDescription = "Menu",
                onNav = onOpenMenu,
            ) {
                IconButton(onClick = onSearch, modifier = Modifier.tvFocusRing()) {
                    Icon(Icons.Filled.Search, contentDescription = "Search")
                }
            }
            if (error != null) {
                Text(
                    error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            val data = home
            if (data != null) {
                if (data.continueWatching.isNotEmpty()) {
                    Shelf(title = "Continue watching") {
                        items(
                            data.continueWatching,
                            key = { "cw-${it.fileId}" },
                            contentType = { "poster" },
                        ) { item ->
                            val subtitle = when {
                                item.type == "episode" && item.resumeCount > 1 ->
                                    "${item.resumeCount} episodes"
                                item.type == "episode" && item.season != null && item.episode != null ->
                                    "S${item.season}E${item.episode.toString().padStart(2, '0')}"
                                else -> null
                            }
                            PosterCard(
                                title = item.title,
                                posterUrl = api.posterUrl(item.posterPath),
                                subtitle = subtitle,
                                modifier = Modifier.width(continueWidth),
                                focusRequester = if (firstKey == "cw-${item.fileId}") firstTile else null,
                                onClick = { onPlay(item.fileId, item.title) },
                            )
                        }
                    }
                }
                if (data.startAnime.isNotEmpty()) {
                    Shelf(title = "Anime", onSeeAll = { onOpenLibrary("anime") }) {
                        items(
                            data.startAnime,
                            key = { "anime-${it.id}" },
                            contentType = { "poster" },
                        ) { show ->
                            PosterCard(
                                title = show.title,
                                posterUrl = api.posterUrl(show.posterPath),
                                modifier = Modifier.width(posterWidth),
                                focusRequester = if (firstKey == "anime-${show.id}") firstTile else null,
                                onClick = { onOpenShow(show.id, show.category.ifBlank { "anime" }) },
                            )
                        }
                    }
                }
                if (data.startTv.isNotEmpty()) {
                    Shelf(title = "Series", onSeeAll = { onOpenLibrary("tv") }) {
                        items(
                            data.startTv,
                            key = { "tv-${it.id}" },
                            contentType = { "poster" },
                        ) { show ->
                            PosterCard(
                                title = show.title,
                                posterUrl = api.posterUrl(show.posterPath),
                                modifier = Modifier.width(posterWidth),
                                focusRequester = if (firstKey == "tv-${show.id}") firstTile else null,
                                onClick = { onOpenShow(show.id, show.category.ifBlank { "tv" }) },
                            )
                        }
                    }
                }
                if (data.movies.isNotEmpty()) {
                    Shelf(title = "Movies", onSeeAll = { onOpenLibrary("movies") }) {
                        items(
                            data.movies,
                            key = { "movie-${it.id}" },
                            contentType = { "poster" },
                        ) { movie ->
                            PosterCard(
                                title = movie.title,
                                posterUrl = api.posterUrl(movie.posterPath),
                                modifier = Modifier.width(posterWidth),
                                focusRequester = if (firstKey == "movie-${movie.id}") firstTile else null,
                                onClick = { onPlay(movie.fileId, movie.title) },
                            )
                        }
                    }
                }
                if (
                    data.continueWatching.isEmpty() &&
                    data.startAnime.isEmpty() &&
                    data.startTv.isEmpty() &&
                    data.movies.isEmpty()
                ) {
                    Text(
                        "Nothing in the library yet.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }

    if (isTv) {
        content()
    } else {
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { scope.launch { reload(showSpinner = false) } },
            modifier = Modifier.fillMaxSize(),
        ) {
            content()
        }
    }
}

@Composable
private fun Shelf(
    title: String,
    onSeeAll: (() -> Unit)? = null,
    content: LazyListScope.() -> Unit,
) {
    Column(modifier = Modifier.padding(top = 18.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
            if (onSeeAll != null) {
                TextButton(onClick = onSeeAll) { Text("See all") }
            }
        }
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            content = content,
        )
    }
}
