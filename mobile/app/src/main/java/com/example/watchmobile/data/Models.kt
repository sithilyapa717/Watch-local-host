package com.example.watchmobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(
    val ok: Boolean = false,
    val app: String = "",
    val port: Int = 8742,
    val name: String = "Watch PC",
)

@Serializable
data class DiscoverResponse(
    val ok: Boolean = false,
    val app: String = "",
    val port: Int = 8742,
    val name: String = "Watch PC",
)

data class FoundPc(
    val name: String,
    val host: String,
    val port: Int,
    val viaUsb: Boolean = false,
)

@Serializable
data class HomePayload(
    @SerialName("continue_watching") val continueWatching: List<ContinueItem> = emptyList(),
    @SerialName("start_anime") val startAnime: List<ShowItem> = emptyList(),
    @SerialName("start_tv") val startTv: List<ShowItem> = emptyList(),
    val movies: List<MovieItem> = emptyList(),
)

@Serializable
data class ContinueItem(
    val type: String = "movie",
    val id: Long = 0,
    val title: String = "",
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("file_id") val fileId: Long = 0,
    val path: String = "",
    @SerialName("position_sec") val positionSec: Double = 0.0,
    @SerialName("duration_sec") val durationSec: Double = 0.0,
    val season: Long? = null,
    val episode: Long? = null,
    @SerialName("resume_count") val resumeCount: Long = 1,
)

@Serializable
data class MovieItem(
    val id: Long,
    @SerialName("file_id") val fileId: Long,
    @SerialName("tmdb_id") val tmdbId: Long = 0,
    val title: String,
    val overview: String = "",
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    val runtime: Long? = null,
    val genres: String = "",
    @SerialName("watch_status") val watchStatus: String = "",
    @SerialName("progress_pct") val progressPct: Double = 0.0,
    @SerialName("file_path") val filePath: String = "",
)

@Serializable
data class ShowItem(
    val id: Long,
    @SerialName("tmdb_id") val tmdbId: Long = 0,
    val title: String,
    val overview: String = "",
    @SerialName("first_air_date") val firstAirDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    val genres: String = "",
    val category: String = "anime",
    val status: String = "",
    @SerialName("owned_count") val ownedCount: Long = 0,
    @SerialName("total_count") val totalCount: Long = 0,
    @SerialName("unwatched_count") val unwatchedCount: Long = 0,
)

@Serializable
data class CompletenessResponse(
    val completeness: ShowCompleteness,
    val summary: String = "",
)

@Serializable
data class ShowCompleteness(
    @SerialName("show_id") val showId: Long,
    val title: String,
    @SerialName("owned_count") val ownedCount: Int = 0,
    @SerialName("total_count") val totalCount: Int = 0,
    val seasons: List<SeasonCompleteness> = emptyList(),
)

@Serializable
data class SeasonCompleteness(
    @SerialName("season_number") val seasonNumber: Int,
    val status: String,
    @SerialName("owned_count") val ownedCount: Int = 0,
    @SerialName("total_count") val totalCount: Int = 0,
    val episodes: List<EpisodeRow> = emptyList(),
)

@Serializable
data class EpisodeRow(
    @SerialName("season_number") val seasonNumber: Int = 0,
    @SerialName("episode_number") val episodeNumber: Int = 0,
    val name: String = "",
    @SerialName("air_date") val airDate: String? = null,
    @SerialName("still_path") val stillPath: String? = null,
    val overview: String = "",
    @SerialName("file_id") val fileId: Long? = null,
    @SerialName("file_path") val filePath: String? = null,
    val status: String = "missing",
    @SerialName("progress_pct") val progressPct: Double = 0.0,
)

@Serializable
data class ProgressBody(
    @SerialName("file_id") val fileId: Long,
    @SerialName("position_sec") val positionSec: Double,
    @SerialName("duration_sec") val durationSec: Double,
)

@Serializable
data class SearchHit(
    @SerialName("entity_type") val entityType: String = "",
    @SerialName("entity_id") val entityId: String = "",
    val title: String = "",
    val overview: String = "",
    val filename: String = "",
)
