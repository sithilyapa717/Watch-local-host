package com.example.watchmobile

import android.app.Application
import android.os.Build
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy

class WatchApplication : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        val tv = BuildConfig.IS_TV
        return ImageLoader.Builder(this)
            .allowHardware(!tv)
            .allowRgb565(tv || Build.VERSION.SDK_INT < 28)
            .crossfade(false)
            .respectCacheHeaders(false)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(if (tv) 0.08 else 0.30)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("poster_cache"))
                    .maxSizeBytes(if (tv) 24L * 1024 * 1024 else 256L * 1024 * 1024)
                    .build()
            }
            .build()
    }
}
