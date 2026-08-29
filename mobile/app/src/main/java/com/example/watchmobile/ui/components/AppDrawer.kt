package com.example.watchmobile.ui

import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

@Composable
fun AppDrawer(
    selected: String,
    onHome: () -> Unit,
    onMovies: () -> Unit,
    onTv: () -> Unit,
    onAnime: () -> Unit,
    onSearch: () -> Unit,
    onRefresh: () -> Unit,
    onChangePc: () -> Unit,
    captureFocus: Boolean = false,
    asRail: Boolean = false,
) {
    val first = remember { FocusRequester() }
    LaunchedEffect(captureFocus) {
        if (!captureFocus) return@LaunchedEffect
        delay(80)
        runCatching { first.requestFocus() }
    }
    val body = @Composable {
        Column(modifier = Modifier.focusGroup()) {
            Text(
                "WATCH",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
            )
            DrawerRow("Home", selected == "home", Icons.Filled.Home, first, onHome)
            DrawerRow("Movies", selected == "movies", Icons.Filled.Movie, null, onMovies)
            DrawerRow("Series", selected == "tv", Icons.Filled.LiveTv, null, onTv)
            DrawerRow("Anime", selected == "anime", Icons.Filled.Theaters, null, onAnime)
            DrawerRow("Search", selected == "search", Icons.Filled.Search, null, onSearch)
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp, horizontal = 24.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
            )
            DrawerRow("Refresh", false, Icons.Filled.Refresh, null, onRefresh)
            DrawerRow("Change PC", false, Icons.Filled.Computer, null, onChangePc)
        }
    }
    if (asRail) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .width(248.dp)
                .padding(end = 8.dp),
        ) {
            body()
        }
    } else {
        ModalDrawerSheet(drawerContainerColor = MaterialTheme.colorScheme.background) {
            body()
        }
    }
}

@Composable
private fun DrawerRow(
    label: String,
    selected: Boolean,
    icon: ImageVector,
    focusRequester: FocusRequester?,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .watchClickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        )
        Text(
            label,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
