package com.example.watchmobile.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import com.example.watchmobile.data.MovieItem
import com.example.watchmobile.data.ShowItem
import com.example.watchmobile.data.WatchApi
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    kind: String,
    api: WatchApi,
    refreshTick: Int,
    onOpenMenu: () -> Unit,
    onSearch: () -> Unit,
    onOpenShow: (Long, String) -> Unit,
    onPlayMovie: (Long, String) -> Unit,
) {
    var movies by remember { mutableStateOf<List<MovieItem>>(emptyList()) }
    var shows by remember { mutableStateOf<List<ShowItem>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var filters by remember(kind) { mutableStateOf(LibraryFilters()) }
    var filtersOpen by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val isMovies = kind == "movies"
    val title = when (kind) {
        "anime" -> "Anime"
        "tv" -> "Series"
        else -> "Movies"
    }

    suspend fun reload(initial: Boolean) {
        if (initial) loading = true else refreshing = true
        try {
            if (isMovies) movies = api.movies()
            else shows = api.shows(kind)
            error = null
        } catch (e: Exception) {
            error = e.message
        } finally {
            loading = false
            refreshing = false
        }
    }

    LaunchedEffect(kind) {
        filters = LibraryFilters()
        filtersOpen = false
    }

    LaunchedEffect(kind, refreshTick) {
        reload(initial = movies.isEmpty() && shows.isEmpty())
    }

    val genres = remember(movies, shows, kind) { availableGenres(movies, shows) }
    val filteredMovies = remember(movies, filters) { applyMovieFilters(movies, filters) }
    val filteredShows = remember(shows, filters) { applyShowFilters(shows, filters) }

    val isTv = LocalIsTv.current
    val cell = if (isTv) 160.dp else 108.dp
    val firstTile = remember { FocusRequester() }
    val firstId = if (isMovies) filteredMovies.firstOrNull()?.id else filteredShows.firstOrNull()?.id

    LaunchedEffect(kind, firstId, isTv) {
        if (!isTv || firstId == null) return@LaunchedEffect
        kotlinx.coroutines.delay(160)
        runCatching { firstTile.requestFocus() }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        ScreenHeader(
            title = title,
            navIcon = Icons.Filled.Menu,
            navDescription = "Menu",
            onNav = onOpenMenu,
        ) {
            IconButton(onClick = onSearch, modifier = Modifier.tvFocusRing()) {
                Icon(Icons.Filled.Search, contentDescription = "Search")
            }
            IconButton(onClick = { filtersOpen = !filtersOpen }, modifier = Modifier.tvFocusRing()) {
                Icon(Icons.Filled.FilterList, contentDescription = "Filter")
            }
        }
        if (loading) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surface,
            )
        }
        AnimatedVisibility(visible = filtersOpen) {
            FilterPanel(
                filters = filters,
                onChange = { filters = it },
                genres = genres,
                showCollection = !isMovies,
            )
        }
        if (error != null) {
            Text(
                error!!,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            )
        }
        val grid: @Composable () -> Unit = {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(cell),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                if (isMovies) {
                    items(filteredMovies, key = { it.id }) { movie ->
                        PosterCard(
                            title = movie.title,
                            posterUrl = api.posterUrl(movie.posterPath),
                            modifier = Modifier.fillMaxWidth(),
                            focusRequester = if (movie.id == firstId) firstTile else null,
                            onClick = { onPlayMovie(movie.fileId, movie.title) },
                        )
                    }
                } else {
                    items(filteredShows, key = { it.id }) { show ->
                        PosterCard(
                            title = show.title,
                            posterUrl = api.posterUrl(show.posterPath),
                            modifier = Modifier.fillMaxWidth(),
                            focusRequester = if (show.id == firstId) firstTile else null,
                            onClick = { onOpenShow(show.id, kind) },
                        )
                    }
                }
            }
        }
        if (isTv) {
            grid()
        } else {
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { scope.launch { reload(initial = false) } },
                modifier = Modifier.fillMaxSize(),
            ) {
                grid()
            }
        }
    }
}
