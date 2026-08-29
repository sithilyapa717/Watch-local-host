plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.example.watchmobile"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.watchmobile"
        minSdk = 26
        targetSdk = 36
        versionCode = 6
        versionName = "1.3"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Signs release with the local debug keystore so `installRelease` works
    // without managing a separate key for a personal LAN app.
    signingConfigs {
        create("local") {
            storeFile = File(System.getProperty("user.home"), ".android/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            signingConfig = signingConfigs.getByName("local")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    flavorDimensions += "device"
    productFlavors {
        create("phone") {
            dimension = "device"
            isDefault = true
            buildConfigField("boolean", "IS_TV", "false")
        }
        create("tv") {
            dimension = "device"
            applicationIdSuffix = ".tv"
            versionCode = 7
            versionName = "1.4"
            versionNameSuffix = "-tv"
            buildConfigField("boolean", "IS_TV", "true")
            ndk {
                abiFilters += listOf("armeabi-v7a")
            }
        }
    }
    packaging {
        resources.excludes += setOf(
            "META-INF/*.version",
            "DebugProbesKt.bin",
            "kotlin-tooling-metadata.json",
        )
        jniLibs {
            useLegacyPackaging = true
            pickFirsts += "**/libc++_shared.so"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.ui)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.profileinstaller)
    "tvImplementation"("org.videolan.android:libvlc-all:3.6.0")
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}

androidComponents {
    beforeVariants(selector().withFlavor("device", "tv").withBuildType("release")) { variant ->
        variant.isMinifyEnabled = false
        variant.shrinkResources = false
    }
}

val releaseAndroid = rootProject.projectDir.parentFile.resolve("release").resolve("android")

tasks.register<Copy>("copyTvReleaseToDist") {
    dependsOn("assembleTvRelease")
    from(layout.buildDirectory.dir("outputs/apk/tv/release"))
    include("*.apk")
    rename { "Watch-tv.apk" }
    into(releaseAndroid.resolve("tv"))
}

tasks.register<Copy>("copyPhoneReleaseToDist") {
    dependsOn("assemblePhoneRelease")
    from(layout.buildDirectory.dir("outputs/apk/phone/release"))
    include("*.apk")
    rename { "Watch-phone.apk" }
    into(releaseAndroid.resolve("phone"))
}
