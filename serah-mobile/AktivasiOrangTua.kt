package id.satu.ortu // ganti sesuai package aplikasi

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/*
 * Aktivasi akun orang tua lewat link undangan dari guru (SATU).
 *
 * Alur:
 *  1. Orang tua menempel link, mis. https://tunarungu.neotelemetri.id/undangan/0_bBi9Pk...
 *  2. Aplikasi mengambil token (teks setelah "/" terakhir) -> GET /api/invites/{token}
 *     -> tampil "Halo Orang tua Raka, anak: Raka".
 *  3. Isi email + sandi (min 8) -> POST /api/invites/{token}/accept -> dapat token orang tua, langsung masuk.
 *  4. Login berikutnya cukup POST /api/auth/parent/login { email, password } (layar login biasa).
 *
 * Tanpa library tambahan: HttpURLConnection + org.json (bawaan Android) + coroutines.
 * Wajib di AndroidManifest.xml:  <uses-permission android:name="android.permission.INTERNET" />
 *
 * Pakai:
 *   AktivasiOrangTuaScreen(onMasuk = { token -> navController.navigate("beranda") })
 */

const val BASE_URL = "https://tunarungu.neotelemetri.id/api"

// ------------------------------------------------------------------ API

class ApiError(val status: Int, message: String) : Exception(message)

data class InfoUndangan(val namaOrangTua: String, val anak: List<String>)
data class SesiOrangTua(val token: String, val id: String, val nama: String, val email: String)

object SatuApi {
    /** Token = bagian terakhir link. Juga menerima token yang ditempel langsung. */
    fun ambilToken(linkAtauToken: String): String =
        linkAtauToken.trim().trimEnd('/').substringAfterLast('/').substringBefore('?')

    private suspend fun panggil(method: String, path: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = (URL(BASE_URL + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 20_000
                setRequestProperty("Accept", "application/json")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val kode = conn.responseCode
                val teks = (if (kode in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                val json = if (teks.isBlank()) JSONObject() else JSONObject(teks)
                if (kode !in 200..299) throw ApiError(kode, json.optString("detail", "Terjadi kesalahan ($kode)"))
                json
            } catch (e: ApiError) {
                throw e
            } catch (e: Exception) {
                throw ApiError(0, "Tidak bisa terhubung ke server. Periksa internet.")
            } finally {
                conn.disconnect()
            }
        }

    /** GET /invites/{token}: 404 = link sudah dipakai / kedaluwarsa. */
    suspend fun infoUndangan(token: String): InfoUndangan {
        val j = panggil("GET", "/invites/$token")
        val anak = j.getJSONArray("children")
        return InfoUndangan(j.getString("parentName"), List(anak.length()) { anak.getString(it) })
    }

    /** POST /invites/{token}/accept: 409 = email sudah dipakai, 400 = data tidak valid. */
    suspend fun aktifkan(token: String, email: String, sandi: String): SesiOrangTua {
        val j = panggil("POST", "/invites/$token/accept", JSONObject().put("email", email).put("password", sandi))
        val p = j.getJSONObject("parent")
        return SesiOrangTua(j.getString("token"), p.getString("id"), p.getString("name"), p.getString("email"))
    }

    /** POST /auth/parent/login: untuk layar login biasa setelah aktivasi. */
    suspend fun login(email: String, sandi: String): SesiOrangTua {
        val j = panggil("POST", "/auth/parent/login", JSONObject().put("email", email).put("password", sandi))
        val p = j.getJSONObject("parent")
        return SesiOrangTua(j.getString("token"), p.getString("id"), p.getString("name"), p.getString("email"))
    }
}

/** Token orang tua berlaku 30 hari. Kirim sebagai header: Authorization: Bearer <token>. */
fun simpanSesi(context: Context, sesi: SesiOrangTua) {
    context.getSharedPreferences("satu", Context.MODE_PRIVATE).edit()
        .putString("token_ortu", sesi.token)
        .putString("nama_ortu", sesi.nama)
        .apply()
}

// ------------------------------------------------------------------ Layar

@Composable
fun AktivasiOrangTuaScreen(onMasuk: (token: String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var link by remember { mutableStateOf("") }
    var token by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<InfoUndangan?>(null) }
    var email by remember { mutableStateOf("") }
    var sandi by remember { mutableStateOf("") }
    var galat by remember { mutableStateOf("") }
    var sibuk by remember { mutableStateOf(false) }

    fun pesan(e: Exception): String = when ((e as? ApiError)?.status) {
        404 -> "Link undangan tidak berlaku (sudah dipakai atau lewat 7 hari). Minta guru membuat link baru."
        409 -> "Email ini sudah dipakai akun lain."
        400 -> "Periksa lagi: email harus valid dan sandi minimal 8 karakter."
        else -> e.message ?: "Terjadi kesalahan"
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Aktivasi Akun Orang Tua", style = MaterialTheme.typography.headlineSmall)

        if (info == null) {
            // Langkah 1: tempel link dari guru
            Text("Tempel link undangan yang dikirim guru.")
            OutlinedTextField(
                value = link,
                onValueChange = { link = it; galat = "" },
                label = { Text("Link undangan") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                enabled = link.isNotBlank() && !sibuk,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    scope.launch {
                        sibuk = true; galat = ""
                        try {
                            val t = SatuApi.ambilToken(link)
                            info = SatuApi.infoUndangan(t)
                            token = t
                        } catch (e: Exception) {
                            galat = pesan(e)
                        } finally {
                            sibuk = false
                        }
                    }
                },
            ) { Text("Lanjut") }
        } else {
            // Langkah 2: buat email + sandi
            Text("Halo, ${info!!.namaOrangTua}!")
            Text("Anak: ${info!!.anak.joinToString(", ")}")
            OutlinedTextField(
                value = email,
                onValueChange = { email = it; galat = "" },
                label = { Text("Email (Gmail)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = sandi,
                onValueChange = { sandi = it; galat = "" },
                label = { Text("Kata sandi (min. 8 karakter)") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                enabled = email.isNotBlank() && sandi.length >= 8 && !sibuk,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    scope.launch {
                        sibuk = true; galat = ""
                        try {
                            val sesi = SatuApi.aktifkan(token!!, email.trim(), sandi)
                            simpanSesi(context, sesi)
                            onMasuk(sesi.token)
                        } catch (e: Exception) {
                            galat = pesan(e)
                            // Link sudah tidak berlaku: kembali ke langkah 1.
                            if ((e as? ApiError)?.status == 404) { info = null; token = null }
                        } finally {
                            sibuk = false
                        }
                    }
                },
            ) { Text("Aktifkan & Masuk") }
        }

        if (sibuk) CircularProgressIndicator()
        if (galat.isNotEmpty()) Text(galat, color = Color(0xFFD93A3A))
    }
}
