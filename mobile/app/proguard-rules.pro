-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# kotlinx.serialization generates companion serializers that are only reached
# reflectively from decodeFromString<T>().
-keepclassmembers class com.example.watchmobile.data.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.example.watchmobile.data.**$$serializer { *; }
-keep class com.example.watchmobile.data.** { <fields>; }
-dontnote kotlinx.serialization.**

-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

-keep class org.videolan.** { *; }
-dontwarn org.videolan.**
