package com.example.watchmobile.ui

import com.example.watchmobile.data.MovieItem
import com.example.watchmobile.data.ShowItem

data class LibraryFilters(
    val watchStatus: String = "all",
    val collectionStatus: String = "all",
    val sort: String = "title_asc",
    val genres: Set<String> = emptySet(),
)

fun genreList(raw: String): List<String> =
    raw.split(",", "/").map { it.trim() }.filter { it.isNotEmpty() }

fun availableGenres(movies: List<MovieItem>, shows: List<ShowItem>): List<String> =
    (movies.flatMap { genreList(it.genres) } + shows.flatMap { genreList(it.genres) })
        .distinct()
        .sorted()

fun applyMovieFilters(movies: List<MovieItem>, filters: LibraryFilters): List<MovieItem> {
    var result = movies.asSequence()
    if (filters.watchStatus != "all") {
        result = result.filter { it.watchStatus == filters.watchStatus }
    }
    if (filters.genres.isNotEmpty()) {
        result = result.filter { movie ->
            genreList(movie.genres).any { it in filters.genres }
        }
    }
    return sortMovies(result.toList(), filters.sort)
}

fun applyShowFilters(shows: List<ShowItem>, filters: LibraryFilters): List<ShowItem> {
    var result = shows.asSequence()
    when (filters.collectionStatus) {
        "complete" -> result = result.filter { it.totalCount > 0 && it.ownedCount >= it.totalCount }
        "incomplete" -> result = result.filter { it.totalCount > 0 && it.ownedCount < it.totalCount }
        "has_missing" -> result = result.filter { it.ownedCount < it.totalCount }
    }
    when (filters.watchStatus) {
        "unwatched" -> result = result.filter { it.unwatchedCount > 0 }
        "in_progress" -> result = result.filter {
            it.unwatchedCount > 0 && it.unwatchedCount < it.ownedCount
        }
        "watched" -> result = result.filter { it.ownedCount > 0 && it.unwatchedCount == 0L }
    }
    if (filters.genres.isNotEmpty()) {
        result = result.filter { show ->
            genreList(show.genres).any { it in filters.genres }
        }
    }
    return sortShows(result.toList(), filters.sort)
}

private fun sortMovies(list: List<MovieItem>, sort: String): List<MovieItem> = when (sort) {
    "title_desc" -> list.sortedByDescending { it.title.lowercase() }
    "rating" -> list.sortedByDescending { it.voteAverage }
    else -> list.sortedBy { it.title.lowercase() }
}

private fun sortShows(list: List<ShowItem>, sort: String): List<ShowItem> = when (sort) {
    "title_desc" -> list.sortedByDescending { it.title.lowercase() }
    "rating" -> list.sortedByDescending { it.voteAverage }
    else -> list.sortedBy { it.title.lowercase() }
}
