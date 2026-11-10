# Capacitor discovers plugin annotations and JavaScript-facing methods at run
# time. Its consumer rules keep plugin implementations; keep the annotation
# types too so R8 full mode cannot remove the runtime discovery contract.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keep @interface com.getcapacitor.annotation.CapacitorPlugin
-keep @interface com.getcapacitor.PluginMethod
-keep @interface com.getcapacitor.annotation.Permission
-keep @interface com.getcapacitor.annotation.PermissionCallback
-keep @interface com.getcapacitor.annotation.ActivityCallback

# MainActivity loads these Play-only plugins by their distribution class name.
-keepnames class com.meadowandmarket.game.MeadowStorePlugin
-keepnames class com.meadowandmarket.game.MeadowAdsPlugin

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
