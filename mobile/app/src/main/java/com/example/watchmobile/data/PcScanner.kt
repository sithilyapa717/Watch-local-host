package com.example.watchmobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

object PcScanner {
    private const val DISCOVER_PORT = 8743
    private const val HTTP_PORT = 8742

    suspend fun broadcastFind(): List<FoundPc> = withContext(Dispatchers.IO) {
        val found = linkedMapOf<String, FoundPc>()
        val socket = DatagramSocket().apply {
            broadcast = true
            soTimeout = 900
            reuseAddress = true
        }
        try {
            val payload = "WATCH?".toByteArray()
            val broadcast = InetAddress.getByName("255.255.255.255")
            socket.send(DatagramPacket(payload, payload.size, broadcast, DISCOVER_PORT))
            val buf = ByteArray(1024)
            val end = System.currentTimeMillis() + 900
            while (System.currentTimeMillis() < end) {
                try {
                    val packet = DatagramPacket(buf, buf.size)
                    socket.receive(packet)
                    val text = String(packet.data, 0, packet.length)
                    val json = JSONObject(text)
                    if (json.optString("app") != "watch" && !json.optBoolean("ok")) continue
                    val host = packet.address.hostAddress ?: continue
                    if (host.contains(":")) continue
                    found[host] = FoundPc(
                        name = json.optString("name", "Watch PC"),
                        host = host,
                        port = json.optInt("port", HTTP_PORT),
                    )
                } catch (_: Exception) {
                    break
                }
            }
        } finally {
            socket.close()
        }
        found.values.toList()
    }
}
