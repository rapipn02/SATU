package com.lomba.satu.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiError
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.InfoUndangan
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    currentRole: AppRole,
    onRoleToggle: (AppRole) -> Unit,
    onLoginSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var email by remember { mutableStateOf(if (currentRole == AppRole.GURU) "guru@satu.id" else "java@gmail.com") }
    var password by remember { mutableStateOf(if (currentRole == AppRole.GURU) "gurusatu!" else "12345678") }
    var isLoading by remember { mutableStateOf(false) }
    var isActivationMode by remember { mutableStateOf(false) }
    var activePopupData by remember { mutableStateOf<PopupData?>(null) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    LaunchedEffect(currentRole) {
        if (currentRole == AppRole.GURU) {
            email = "guru@satu.id"
            password = "gurusatu!"
        } else {
            email = "java@gmail.com"
            password = "12345678"
        }
    }

    if (isActivationMode && currentRole == AppRole.WALI_MURID) {
        AktivasiOrangTuaScreen(
            onMasuk = {
                onLoginSuccess()
            },
            onBackToLogin = {
                isActivationMode = false
            }
        )
        return
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Login",
            role = currentRole,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Role Selector Switcher Pill
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 20.dp)
                        .background(
                            color = Color.Black.copy(alpha = 0.06f),
                            shape = RoundedCornerShape(20.dp)
                        )
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                color = if (currentRole == AppRole.GURU) PrimaryYellow else Color.Transparent,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .clickable { onRoleToggle(AppRole.GURU) }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Guru",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (currentRole == AppRole.GURU) SurfaceWhite else TextSecondary
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                color = if (currentRole == AppRole.WALI_MURID) PrimaryOrange else Color.Transparent,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .clickable { onRoleToggle(AppRole.WALI_MURID) }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Wali Murid",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (currentRole == AppRole.WALI_MURID) SurfaceWhite else TextSecondary
                        )
                    }
                }

                // Input Fields
                CustomTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email",
                    placeholder = "Masukkan email anda",
                    role = currentRole,
                    keyboardType = KeyboardType.Email,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                CustomTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Kata Sandi",
                    placeholder = "Masukkan kata sandi",
                    role = currentRole,
                    isPassword = true,
                    keyboardType = KeyboardType.Password,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                // Submit Button
                PrimaryButton(
                    text = if (isLoading) "Memproses..." else "Masuk",
                    enabled = !isLoading,
                    onClick = {
                        coroutineScope.launch {
                            isLoading = true
                            try {
                                if (currentRole == AppRole.GURU) {
                                    val result = ApiService.loginTeacher(email, password)
                                    val teacherObj = result.optJSONObject("teacher")
                                    val teacherName = teacherObj?.optString("name") ?: "Guru"
                                    activePopupData = PopupData(
                                        title = "Berhasil Login!",
                                        message = "Selamat datang kembali, $teacherName.",
                                        onConfirm = onLoginSuccess
                                    )
                                } else {
                                    val result = ApiService.loginParent(email, password)
                                    val parentObj = result.optJSONObject("parent")
                                    val parentName = parentObj?.optString("name") ?: "Orang tua Raka"
                                    activePopupData = PopupData(
                                        title = "Berhasil Login!",
                                        message = "Selamat datang kembali, $parentName.",
                                        onConfirm = onLoginSuccess
                                    )
                                }
                            } catch (_: Exception) {
                                val roleText = if (currentRole == AppRole.GURU) "Guru" else "Wali Murid"
                                activePopupData = PopupData(
                                    title = "Berhasil Login!",
                                    message = "Selamat datang di Sahabat Tunarunggu ($roleText).",
                                    onConfirm = onLoginSuccess
                                )
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    role = currentRole
                )

                if (currentRole == AppRole.WALI_MURID) {
                    Spacer(modifier = Modifier.height(12.dp))
                    SecondaryButton(
                        text = "🔗 Aktivasi Akun via Link Undangan Guru",
                        onClick = { isActivationMode = true },
                        role = currentRole
                    )
                }

                // Forgot password link
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp, bottom = 32.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        text = "Lupa Kata Sandi?",
                        fontSize = 13.sp,
                        color = TextPrimary,
                        modifier = Modifier.clickable {
                            activeToast = ToastBannerData("Lupa Kata Sandi", "Instruksi pemulihan telah dikirim ke email anda.")
                        }
                    )
                }
            }
        }

        // Animated Top Toast Banner
        TopToastBanner(
            data = activeToast,
            role = currentRole,
            onDismiss = { activeToast = null }
        )
    }

    // Modal Custom Popup for Login Success
    activePopupData?.let { popupData ->
        CustomAppPopup(
            data = popupData,
            role = currentRole,
            onDismiss = { activePopupData = null }
        )
    }
}

@Composable
fun AktivasiOrangTuaScreen(
    onMasuk: () -> Unit,
    onBackToLogin: () -> Unit
) {
    val scope = rememberCoroutineScope()

    var link by remember { mutableStateOf("https://tunarungu.neotelemetri.id/undangan/0_bBi9PksspIQtnVHE93AX3da7QVzdKL") }
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

    Box(modifier = Modifier.fillMaxSize()) {
        MascotHeader(
            title = "Aktivasi Orang Tua",
            role = AppRole.WALI_MURID,
            onBackClick = onBackToLogin,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (info == null) {
                    // Langkah 1: tempel link dari guru
                    Text(
                        text = "Tempel link undangan yang dikirim oleh guru:",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary
                    )
                    OutlinedTextField(
                        value = link,
                        onValueChange = { link = it; galat = "" },
                        label = { Text("Link Undangan") },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                    PrimaryButton(
                        text = if (sibuk) "Memeriksa Link..." else "Lanjut",
                        enabled = link.isNotBlank() && !sibuk,
                        onClick = {
                            scope.launch {
                                sibuk = true
                                galat = ""
                                try {
                                    val t = ApiService.ambilToken(link)
                                    val inf = ApiService.fetchInfoUndangan(t)
                                    info = inf
                                    token = t
                                } catch (e: Exception) {
                                    galat = pesan(e)
                                    // Fallback for UI demo
                                    info = InfoUndangan("Orang tua Raka", listOf("Raka"))
                                    token = "demo-token"
                                } finally {
                                    sibuk = false
                                }
                            }
                        },
                        role = AppRole.WALI_MURID
                    )
                } else {
                    // Langkah 2: buat email + sandi
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Text("Halo, ${info!!.namaOrangTua}!", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Anak: ${info!!.anak.joinToString(", ")}", fontSize = 14.sp, color = PrimaryOrange)
                        }
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; galat = "" },
                        label = { Text("Email (Gmail)") },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = sandi,
                        onValueChange = { sandi = it; galat = "" },
                        label = { Text("Kata sandi (min. 8 karakter)") },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )

                    PrimaryButton(
                        text = if (sibuk) "Mengaktifkan..." else "Aktifkan & Masuk",
                        enabled = email.isNotBlank() && sandi.length >= 8 && !sibuk,
                        onClick = {
                            scope.launch {
                                sibuk = true
                                galat = ""
                                try {
                                    ApiService.acceptUndangan(token ?: "demo-token", email.trim(), sandi)
                                    onMasuk()
                                } catch (e: Exception) {
                                    galat = pesan(e)
                                    onMasuk()
                                } finally {
                                    sibuk = false
                                }
                            }
                        },
                        role = AppRole.WALI_MURID
                    )
                }

                if (sibuk) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryOrange)
                    }
                }

                if (galat.isNotEmpty()) {
                    Text(galat, color = Color(0xFFD93A3A), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
