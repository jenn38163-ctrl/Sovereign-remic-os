# Add project-specific ProGuard rules here.
# By default, keep data classes and Firebase models intact.
-keep class com.sovereignremic.os.** { * }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Firebase & Play Services
-keep class com.google.firebase.** { * }
-keep class com.google.android.gms.** { * }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
