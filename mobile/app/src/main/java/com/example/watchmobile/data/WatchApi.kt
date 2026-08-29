package com.example.watchmobile.data

import androidx.compose.runtime.Stable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

@Stable
class WatchApi(private val store: SessionStore) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun url(path: String, extraQuery: String = ""): String {
        val token = URLEncoder.encode(store.token, "UTF-8")
        val sep = if (path.contains("?")) "&" else "?"
        val extra = if (extraQuery.isEmpty()) "" else "&$extraQuery"
        return "${store.baseUrl}$path${sep}token=$token$extra"
    }

    private suspend fun getBody(path: String, extraQuery: String = ""): String =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(url(path, extraQuery))
                .header("Authorization", "Bearer ${store.token}")
                .get()
                .build()
            http.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("HTTP ${response.code}: ${body.take(200)}")
                }
                body
            }
        }

    suspend fun health(): HealthResponse {
        val request = Request.Builder()
            .url("${store.baseUrl}/api/health")
            .get()
            .build()
        return withContext(Dispatchers.IO) {
            http.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("PC not reachable (${response.code})")
                }
                json.decodeFromString(body)
            }
        }
    }

    suspend fun probe(host: String, port: Int): FoundPc? = withContext(Dispatchers.IO) {
        val client = http.newBuilder().connectTimeout(800, TimeUnit.MILLISECONDS)
            .readTimeout(800, TimeUnit.MILLISECONDS).build()
        val request = Request.Builder()
            .url("http://$host:$port/api/discover")
            .get()
            .build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val info = json.decodeFromString<DiscoverResponse>(response.body?.string().orEmpty())
                if (info.app != "watch" && !info.ok) return@withContext null
                FoundPc(
                    name = info.name.ifBlank { "Watch PC" },
                    host = host,
                    port = if (info.port > 0) info.port else port,
                    viaUsb = host == "127.0.0.1",
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    @Volatile
    var cachedHome: HomePayload? = null
        private set

    private val completenessCache = java.util.concurrent.ConcurrentHashMap<Long, CompletenessResponse>()

    fun clearCache() {
        cachedHome = null
        completenessCache.clear()
    }

    fun peekCompleteness(showId: Long): CompletenessResponse? = completenessCache[showId]

    suspend fun home(): HomePayload {
        val payload: HomePayload = json.decodeFromString(getBody("/api/home"))
        cachedHome = payload
        return payload
    }

    suspend fun movies(): List<MovieItem> = json.decodeFromString(getBody("/api/movies"))

    suspend fun shows(category: String): List<ShowItem> =
        json.decodeFromString(getBody("/api/shows", "category=$category"))

    suspend fun completeness(showId: Long, force: Boolean = false): CompletenessResponse {
        if (!force) completenessCache[showId]?.let { return it }
        val payload: CompletenessResponse = json.decodeFromString(getBody("/api/shows/$showId/completeness"))
        completenessCache[showId] = payload
        return payload
    }

    suspend fun search(query: String): List<SearchHit> {
        val q = URLEncoder.encode(query, "UTF-8")
        return json.decodeFromString(getBody("/api/search", "q=$q"))
    }

    suspend fun saveProgress(fileId: Long, positionSec: Double, durationSec: Double) {
        withContext(Dispatchers.IO) {
            val payload = json.encodeToString(ProgressBody(fileId, positionSec, durationSec))
            val request = Request.Builder()
                .url(url("/api/progress"))
                .header("Authorization", "Bearer ${store.token}")
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful && response.code != 204) {
                    throw IllegalStateException("Could not save progress (${response.code})")
                }
            }
        }
    }

    // Called from composition for every visible poster, so the encode + string
    // building is memoized to keep list scrolling allocation-free.
    private val posterUrls = java.util.concurrent.ConcurrentHashMap<String, String>()
    private var posterOrigin = ""

    fun posterUrl(path: String?): String? {
        if (path.isNullOrBlank()) return null
        val origin = "${store.baseUrl}|${store.token}"
        if (origin != posterOrigin) {
            posterUrls.clear()
            posterOrigin = origin
        }
        return posterUrls.getOrPut(path) {
            url("/api/poster", "path=${URLEncoder.encode(path, "UTF-8")}")
        }
    }

    fun streamUrl(fileId: Long): String = url("/api/stream/$fileId")
}
