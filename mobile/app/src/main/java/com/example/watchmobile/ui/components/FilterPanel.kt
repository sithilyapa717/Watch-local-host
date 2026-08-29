package com.example.watchmobile.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun FilterPanel(
    filters: LibraryFilters,
    onChange: (LibraryFilters) -> Unit,
    genres: List<String>,
    showCollection: Boolean,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
    ) {
        ChipRow {
            StatusChip("All", filters.watchStatus == "all") { onChange(filters.copy(watchStatus = "all")) }
            StatusChip("Unwatched", filters.watchStatus == "unwatched") { onChange(filters.copy(watchStatus = "unwatched")) }
            StatusChip("Watching", filters.watchStatus == "in_progress") { onChange(filters.copy(watchStatus = "in_progress")) }
            StatusChip("Watched", filters.watchStatus == "watched") { onChange(filters.copy(watchStatus = "watched")) }
        }
        if (showCollection) {
            ChipRow {
                StatusChip("All titles", filters.collectionStatus == "all") { onChange(filters.copy(collectionStatus = "all")) }
                StatusChip("Complete", filters.collectionStatus == "complete") { onChange(filters.copy(collectionStatus = "complete")) }
                StatusChip("Incomplete", filters.collectionStatus == "incomplete") { onChange(filters.copy(collectionStatus = "incomplete")) }
            }
        }
        ChipRow {
            StatusChip("A–Z", filters.sort == "title_asc") { onChange(filters.copy(sort = "title_asc")) }
            StatusChip("Z–A", filters.sort == "title_desc") { onChange(filters.copy(sort = "title_desc")) }
            StatusChip("Rating", filters.sort == "rating") { onChange(filters.copy(sort = "rating")) }
        }
        if (genres.isNotEmpty()) {
            ChipRow {
                genres.take(16).forEach { genre ->
                    FilterChip(
                        selected = genre in filters.genres,
                        onClick = {
                            val next = filters.genres.toMutableSet()
                            if (!next.add(genre)) next.remove(genre)
                            onChange(filters.copy(genres = next))
                        },
                        label = { Text(genre) },
                        colors = quietChipColors(),
                    )
                }
            }
        }
    }
}

@Composable
private fun quietChipColors() = FilterChipDefaults.filterChipColors(
    containerColor = MaterialTheme.colorScheme.background,
    selectedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
    labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
    selectedLabelColor = MaterialTheme.colorScheme.onSurface,
)

@Composable
private fun ChipRow(content: @Composable () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        content()
    }
}

@Composable
private fun StatusChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        colors = quietChipColors(),
        border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = selected,
            borderColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedBorderColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    )
}
