package com.example.watchmobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.watchmobile.data.FoundPc
import com.example.watchmobile.data.PcScanner
import com.example.watchmobile.data.SessionStore
import com.example.watchmobile.data.WatchApi
import kotlinx.coroutines.delay

@Composable
fun ConnectScreen(
    store: SessionStore,
    api: WatchApi,
    onConnected: () -> Unit,
) {
    var pcs by remember { mutableStateOf<List<FoundPc>>(emptyList()) }
    var scanning by remember { mutableStateOf(true) }
    var selected by remember { mutableStateOf<FoundPc?>(null) }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loggingIn by remember { mutableStateOf(false) }

    LaunchedEffect(selected) {
        if (selected != null) return@LaunchedEffect
        scanning = true
        while (selected == null) {
            val next = linkedMapOf<String, FoundPc>()
            api.probe("127.0.0.1", 8742)?.let { next[it.host] = it.copy(viaUsb = true, name = "${it.name} (USB)") }
            PcScanner.broadcastFind().forEach { next[it.host] = it }
            pcs = next.values.toList()
            scanning = false
            delay(2500)
        }
    }

    LaunchedEffect(pin, selected) {
        val pc = selected ?: return@LaunchedEffect
        if (pin.length != 6 || loggingIn) return@LaunchedEffect
        loggingIn = true
        error = null
        store.savePairing(pc.host, pc.port.toString(), pin)
        try {
            api.home()
            onConnected()
        } catch (_: Exception) {
            store.clearPairing()
            error = "Wrong PIN or PC not ready. Check Watch → Settings."
            pin = ""
        } finally {
            loggingIn = false
        }
    }

    if (selected == null) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Text("WATCH", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                "Looking for your PC on this network.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))
            if (scanning && pcs.isEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                    Text("Looking for your PC", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            LazyColumn {
                items(pcs, key = { it.host }) { pc ->
                    ListItem(
                        headlineContent = { Text(pc.name) },
                        supportingContent = { Text("${pc.host}:${pc.port}") },
                        leadingContent = {
                            Icon(
                                if (pc.viaUsb) Icons.Filled.Usb else Icons.Filled.Computer,
                                contentDescription = null,
                            )
                        },
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .watchClickable { selected = pc; pin = ""; error = null },
                        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
            if (!scanning && pcs.isEmpty()) {
                Text(
                    "No PC found. Same Wi-Fi as the computer, and Watch must be running.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    } else {
        val pc = selected!!
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Connect to", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(pc.name, style = MaterialTheme.typography.headlineSmall)
            Text(pc.host, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(24.dp))
            Text("Enter PIN from Watch → Settings", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(6) { i ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.size(width = 40.dp, height = 52.dp),
                    ) {
                        Text(
                            pin.getOrNull(i)?.toString() ?: "",
                            modifier = Modifier.padding(top = 12.dp).fillMaxWidth(),
                            textAlign = TextAlign.Center,
                            fontSize = 22.sp,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp), textAlign = TextAlign.Center)
            }
            if (loggingIn) {
                CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp).size(28.dp), strokeWidth = 3.dp)
            }
            Spacer(Modifier.height(20.dp))
            PinPad(
                onDigit = { if (pin.length < 6) pin += it },
                onDelete = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
            )
            TextButton(onClick = { selected = null; pin = ""; error = null }) {
                Text("Choose a different PC")
            }
        }
    }
}

@Composable
private fun PinPad(onDigit: (String) -> Unit, onDelete: () -> Unit) {
    val isTv = LocalIsTv.current
    val keySize = if (isTv) 88.dp else 72.dp
    val keys = listOf(
        listOf("1", "2", "3"),
        listOf("4", "5", "6"),
        listOf("7", "8", "9"),
        listOf("", "0", "⌫"),
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        keys.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { key ->
                    Button(
                        onClick = {
                            if (key == "⌫") onDelete()
                            else if (key.isNotEmpty()) onDigit(key)
                        },
                        enabled = key.isNotEmpty(),
                        modifier = Modifier.size(keySize).tvFocusRing(),
                        contentPadding = PaddingValues(0.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                            contentColor = MaterialTheme.colorScheme.onSurface,
                            disabledContainerColor = Color.Transparent,
                        ),
                    ) {
                        Text(key, fontSize = if (isTv) 28.sp else 22.sp)
                    }
                }
            }
        }
    }
}
