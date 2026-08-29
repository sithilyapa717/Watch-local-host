package com.example.watchmobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.watchmobile.data.SearchHit
import com.example.watchmobile.data.WatchApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SearchScreen(
    api: WatchApi,
    onBack: () -> Unit,
    onPlayMovie: (Long, String) -> Unit,
    onOpenShow: (Long) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("all") }
    var results by remember { mutableStateOf<List<SearchHit>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val isTv = LocalIsTv.current
    val focus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        if (!isTv) focus.requestFocus()
    }
    LaunchedEffect(query) {
        val q = query.trim()
        if (q.isEmpty()) {
            results = emptyList()
            error = null
            return@LaunchedEffect
        }
        delay(200)
        try {
            results = api.search(q)
            error = null
        } catch (e: Exception) {
            error = e.message
            results = emptyList()
        }
    }

    val shown = results.filter { type == "all" || it.entityType == type }
    val chipColors = FilterChipDefaults.filterChipColors(
        containerColor = MaterialTheme.colorScheme.background,
        selectedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
    )

    Column(modifier = Modifier.fillMaxSize()) {
        ScreenHeader(
            title = "Search",
            navIcon = Icons.AutoMirrored.Filled.ArrowBack,
            navDescription = "Back",
            onNav = onBack,
        )
        TextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .focusRequester(focus),
            placeholder = { Text("Titles") },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                disabledIndicatorColor = Color.Transparent,
            ),
        )
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(selected = type == "all", onClick = { type = "all" }, label = { Text("All") }, colors = chipColors)
            FilterChip(selected = type == "movie", onClick = { type = "movie" }, label = { Text("Movies") }, colors = chipColors)
            FilterChip(selected = type == "show", onClick = { type = "show" }, label = { Text("Shows") }, colors = chipColors)
        }
        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(20.dp))
        }
        LazyColumn {
            itemsIndexed(shown, key = { i, hit -> "${hit.entityType}-${hit.entityId}-$i" }) { _, hit ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .watchClickable {
                            val id = hit.entityId.toLongOrNull() ?: return@watchClickable
                            scope.launch {
                                if (hit.entityType == "movie") {
                                    val movie = api.movies().find { it.id == id }
                                    if (movie != null) onPlayMovie(movie.fileId, movie.title)
                                } else {
                                    onOpenShow(id)
                                }
                            }
                        }
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                ) {
                    Text(hit.title, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        if (hit.entityType == "movie") "Movie" else "Show",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
            if (query.isNotBlank() && shown.isEmpty() && error == null) {
                item("empty") {
                    Text(
                        "No results",
                        modifier = Modifier.padding(24.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
