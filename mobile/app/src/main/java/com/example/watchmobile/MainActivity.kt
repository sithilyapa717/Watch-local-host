package com.example.watchmobile

import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.zIndex
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.watchmobile.data.SessionStore
import com.example.watchmobile.data.WatchApi
import com.example.watchmobile.ui.AppDrawer
import com.example.watchmobile.ui.ConnectScreen
import com.example.watchmobile.ui.HomeScreen
import com.example.watchmobile.ui.LibraryScreen
import com.example.watchmobile.ui.PlayerScreen
import com.example.watchmobile.ui.SearchScreen
import com.example.watchmobile.ui.ShowDetailScreen
import com.example.watchmobile.ui.SplashScreen
import com.example.watchmobile.ui.StickDpadMapper
import com.example.watchmobile.ui.theme.WatchTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class SessionState { Setup, Connecting, Ready }

class MainActivity : ComponentActivity() {
    private val stickDpad = StickDpadMapper()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // enableEdgeToEdge() recreates / crashes some Android 9 TVs (AIWA / Mali-450).
        if (!BuildConfig.IS_TV) {
            enableEdgeToEdge()
            requestPeakRefreshRate()
        }
        val store = SessionStore(applicationContext)
        val api = WatchApi(store)
        setContent {
            WatchTheme {
                val nav = rememberNavController()
                var session by remember {
                    mutableStateOf(if (store.isPaired) SessionState.Connecting else SessionState.Setup)
                }
                var connectFailed by remember { mutableStateOf(false) }
                var introDone by remember { mutableStateOf(false) }
                var splashVisible by remember { mutableStateOf(true) }

                LaunchedEffect(session) {
                    if (session != SessionState.Connecting) return@LaunchedEffect
                    connectFailed = false
                    while (session == SessionState.Connecting) {
                        try {
                            val health = api.health()
                            if (health.ok) {
                                api.home()
                                session = SessionState.Ready
                                return@LaunchedEffect
                            }
                        } catch (_: Exception) {
                        }
                        connectFailed = true
                        delay(2500)
                    }
                }

                LaunchedEffect(introDone, session) {
                    if (!introDone) return@LaunchedEffect
                    when (session) {
                        SessionState.Setup -> {
                            delay(400)
                            splashVisible = false
                        }
                        SessionState.Ready -> {
                            delay(450)
                            splashVisible = false
                        }
                        SessionState.Connecting -> { }
                    }
                }

                // The window background already paints the app colour; keeping the
                // Scaffold and root Box transparent avoids drawing it three times a frame.
                Box(modifier = Modifier.fillMaxSize()) {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = Color.Transparent,
                    contentColor = MaterialTheme.colorScheme.onBackground,
                ) { inner ->
                    if (!BuildConfig.IS_TV || introDone) when (session) {
                        SessionState.Setup -> ConnectScreen(
                            store = store,
                            api = api,
                            onConnected = { session = SessionState.Ready },
                        )
                        SessionState.Connecting -> Box(Modifier.fillMaxSize())
                        SessionState.Ready -> {
                            val navEntry = nav.currentBackStackEntryAsState().value
                            val route = navEntry?.destination?.route.orEmpty()
                            val libraryKind = navEntry?.arguments?.getString("kind")
                            val selected = when {
                                route == "home" -> "home"
                                libraryKind == "movies" -> "movies"
                                libraryKind == "tv" -> "tv"
                                libraryKind == "anime" -> "anime"
                                route == "search" -> "search"
                                else -> ""
                            }
                            val inPlayer = route.startsWith("player")
                            var playerTitle by remember { mutableStateOf("") }
                            var refreshTick by remember { mutableIntStateOf(0) }
                            var openingShow by remember { mutableStateOf(false) }
                            val drawerState = rememberDrawerState(DrawerValue.Closed)
                            val scope = rememberCoroutineScope()
                            fun closeAnd(go: () -> Unit) {
                                scope.launch {
                                    drawerState.close()
                                    go()
                                }
                            }
                            fun refreshLibrary() {
                                closeAnd {
                                    api.clearCache()
                                    refreshTick += 1
                                }
                            }
                            fun openShow(id: Long, category: String) {
                                if (openingShow) return
                                scope.launch {
                                    openingShow = true
                                    try {
                                        api.completeness(id)
                                    } catch (_: Exception) {
                                    }
                                    nav.navigate("show/$id/$category")
                                    openingShow = false
                                }
                            }
                            fun openLibrary(kind: String) {
                                closeAnd {
                                    nav.navigate("library/$kind") {
                                        popUpTo("home")
                                        launchSingleTop = true
                                    }
                                }
                            }
                            val drawer: @Composable () -> Unit = {
                                AppDrawer(
                                    selected = selected,
                                    onHome = {
                                        closeAnd { nav.popBackStack("home", inclusive = false) }
                                    },
                                    onMovies = { openLibrary("movies") },
                                    onTv = { openLibrary("tv") },
                                    onAnime = { openLibrary("anime") },
                                    onSearch = { closeAnd { nav.navigate("search") } },
                                    onRefresh = { refreshLibrary() },
                                    onChangePc = {
                                        closeAnd {
                                            store.clearPairing()
                                            session = SessionState.Setup
                                        }
                                    },
                                    captureFocus = drawerState.isOpen && !BuildConfig.IS_TV,
                                    asRail = BuildConfig.IS_TV,
                                )
                            }
                            val host: @Composable () -> Unit = {
                            NavHost(
                                navController = nav,
                                startDestination = "home",
                                modifier = Modifier.fillMaxSize(),
                                enterTransition = { fadeIn(tween(120)) },
                                exitTransition = { fadeOut(tween(90)) },
                                popEnterTransition = { fadeIn(tween(120)) },
                                popExitTransition = { fadeOut(tween(90)) },
                            ) {
                                composable("home") {
                                    Box(Modifier.padding(inner).fillMaxSize()) {
                                    HomeScreen(
                                        api = api,
                                        refreshTick = refreshTick,
                                        onOpenLibrary = { nav.navigate("library/$it") },
                                        onOpenShow = { id, cat -> openShow(id, cat) },
                                        onPlay = { fileId, title ->
                                            playerTitle = title
                                            nav.navigate("player/$fileId")
                                        },
                                        onOpenMenu = { scope.launch { drawerState.open() } },
                                        onSearch = { nav.navigate("search") },
                                    )
                                    }
                                }
                                composable(
                                    "library/{kind}",
                                    arguments = listOf(navArgument("kind") { type = NavType.StringType }),
                                ) { entry ->
                                    val kind = entry.arguments?.getString("kind") ?: "movies"
                                    Box(Modifier.padding(inner).fillMaxSize()) {
                                    LibraryScreen(
                                        kind = kind,
                                        api = api,
                                        refreshTick = refreshTick,
                                        onOpenMenu = { scope.launch { drawerState.open() } },
                                        onSearch = { nav.navigate("search") },
                                        onOpenShow = { id, cat -> openShow(id, cat) },
                                        onPlayMovie = { fileId, title ->
                                            playerTitle = title
                                            nav.navigate("player/$fileId")
                                        },
                                    )
                                    }
                                }
                                composable("search") {
                                    Box(Modifier.padding(inner).fillMaxSize()) {
                                    SearchScreen(
                                        api = api,
                                        onBack = { nav.popBackStack() },
                                        onPlayMovie = { fileId, title ->
                                            playerTitle = title
                                            nav.navigate("player/$fileId")
                                        },
                                        onOpenShow = { id -> openShow(id, "tv") },
                                    )
                                    }
                                }
                                composable(
                                    "show/{id}/{category}",
                                    arguments = listOf(
                                        navArgument("id") { type = NavType.LongType },
                                        navArgument("category") { type = NavType.StringType },
                                    ),
                                    enterTransition = { fadeIn(tween(120)) },
                                    exitTransition = { fadeOut(tween(90)) },
                                    popEnterTransition = { fadeIn(tween(120)) },
                                    popExitTransition = { fadeOut(tween(90)) },
                                ) { entry ->
                                    val id = entry.arguments?.getLong("id") ?: 0L
                                    Box(Modifier.padding(inner).fillMaxSize()) {
                                    ShowDetailScreen(
                                        showId = id,
                                        api = api,
                                        refreshTick = refreshTick,
                                        onBack = { nav.popBackStack() },
                                        onPlay = { fileId, title ->
                                            playerTitle = title
                                            nav.navigate("player/$fileId")
                                        },
                                    )
                                    }
                                }
                                composable(
                                    "player/{fileId}",
                                    arguments = listOf(
                                        navArgument("fileId") { type = NavType.LongType },
                                    ),
                                    enterTransition = { EnterTransition.None },
                                    exitTransition = { ExitTransition.None },
                                    popEnterTransition = { EnterTransition.None },
                                    popExitTransition = { ExitTransition.None },
                                ) { entry ->
                                    val fileId = entry.arguments?.getLong("fileId") ?: 0L
                                    PlayerScreen(
                                        fileId = fileId,
                                        title = playerTitle,
                                        api = api,
                                        onBack = {
                                            if (nav.currentBackStackEntry?.destination?.route?.startsWith("player") == true) {
                                                nav.popBackStack()
                                            }
                                        },
                                    )
                                }
                            }
                            }
                            if (BuildConfig.IS_TV) {
                                Row(modifier = Modifier.fillMaxSize()) {
                                    if (!inPlayer) drawer()
                                    Box(modifier = Modifier.weight(1f).fillMaxSize()) { host() }
                                }
                            } else {
                                ModalNavigationDrawer(
                                    drawerState = drawerState,
                                    gesturesEnabled = !inPlayer,
                                    drawerContent = { drawer() },
                                ) {
                                    host()
                                }
                            }
                        }
                    }
                }
                AnimatedVisibility(
                    visible = splashVisible,
                    modifier = Modifier
                        .fillMaxSize()
                        .zIndex(8f),
                    enter = fadeIn(tween(0)),
                    exit = fadeOut(tween(480)),
                ) {
                    SplashScreen(
                        holding = introDone && session != SessionState.Setup,
                        status = when {
                            connectFailed -> "Can't reach ${store.host} yet. Keep Watch open on the PC."
                            session == SessionState.Connecting -> "Loading your library"
                            else -> ""
                        },
                        showChangePc = connectFailed && session == SessionState.Connecting,
                        onIntroFinished = { introDone = true },
                        onChangePc = {
                            store.clearPairing()
                            session = SessionState.Setup
                            if (introDone) splashVisible = false
                        },
                    )
                }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (!BuildConfig.IS_TV) requestPeakRefreshRate()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (BuildConfig.IS_TV && event.action == KeyEvent.ACTION_UP) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_BUTTON_B,
                KeyEvent.KEYCODE_BUTTON_SELECT,
                -> {
                    onBackPressedDispatcher.onBackPressed()
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        if (BuildConfig.IS_TV && stickDpad.dispatch(this, event)) return true
        return super.dispatchGenericMotionEvent(event)
    }
}
