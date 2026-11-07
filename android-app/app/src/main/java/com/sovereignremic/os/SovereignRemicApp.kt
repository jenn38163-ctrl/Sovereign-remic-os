package com.sovereignremic.os

import android.app.Application
import com.google.firebase.FirebaseApp

class SovereignRemicApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
