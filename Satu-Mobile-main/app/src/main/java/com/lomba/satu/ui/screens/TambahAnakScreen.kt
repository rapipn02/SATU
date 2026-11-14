package com.lomba.satu.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun TambahAnakScreen(
    role: AppRole,
    onNextStep: (String, String) -> Unit,
    modifier: Modifier = Modifier,
    onBackClick: (() -> Unit)? = null
) {
    var namaPanggilan by remember { mutableStateOf("") }
    var nomorWa by remember { mutableStateOf("") }
    var selectedPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            selectedPhotoUri = uri
            activeToast = ToastBannerData("Foto Dipilih", "Foto profil anak berhasil dipilih dari galeri.")
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Tambah Anak",
            role = role,
            onBackClick = onBackClick,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    CustomTextField(
                        value = namaPanggilan,
                        onValueChange = { namaPanggilan = it },
                        label = "Nama Panggilan",
                        placeholder = "Masukkan nama panggilan anak",
                        role = role
                    )

                    CustomTextField(
                        value = nomorWa,
                        onValueChange = { nomorWa = it },
                        label = "Nomor WhatsApp Orang Tua",
                        placeholder = "Contoh: 08123456789",
                        role = role,
                        keyboardType = KeyboardType.Phone
                    )

                    DashedUploadBox(
                        label = if (selectedPhotoUri != null) "Foto Profil Ditempel ✓" else "Foto Profil Anak",
                        role = role,
                        onClick = {
                            photoPickerLauncher.launch("image/*")
                        }
                    )
                }

                // Bottom action button: "Tambah Anak" -> opens Buat PIN screen
                PrimaryButton(
                    text = "Tambah Anak",
                    onClick = {
                        val childName = if (namaPanggilan.isNotBlank()) namaPanggilan else "Anak Baru"
                        onNextStep(childName, nomorWa)
                    },
                    role = role,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }

        TopToastBanner(
            data = activeToast,
            role = role,
            onDismiss = { activeToast = null }
        )
    }
}

@Composable
fun AnakDitambahkanScreen(
    inviteLink: String,
    role: AppRole,
    onDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var activePopupData by remember { mutableStateOf<PopupData?>(null) }

    MascotHeader(
        title = "Anak Ditambahkan",
        role = role,
        onBackClick = onDone,
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                CardContainer(role = role) {
                    Column {
                        Text(
                            text = "Link Undangan Orang Tua",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = inviteLink,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
                        )
                    }
                }
            }

            // Action Buttons: "Kirim Via WA" & "Salin Link"
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                PrimaryButton(
                    text = "Kirim Via WA",
                    onClick = {
                        val message = "Link undangan orang tua Satu: $inviteLink"
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, message)
                        }
                        try {
                            context.startActivity(Intent.createChooser(intent, "Kirim via WhatsApp"))
                        } catch (_: Exception) {}

                        activePopupData = PopupData(
                            title = "Kirim WhatsApp",
                            message = "Link undangan disiapkan untuk dikirim via WhatsApp."
                        )
                    },
                    role = role
                )

                SecondaryButton(
                    text = "Salin Link",
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Invite Link", inviteLink)
                        clipboard.setPrimaryClip(clip)
                        activePopupData = PopupData(
                            title = "Link Disalin!",
                            message = "Link undangan '$inviteLink' telah disalin ke clipboard."
                        )
                    },
                    role = role
                )
            }
        }
    }

    activePopupData?.let { popupData ->
        CustomAppPopup(
            data = popupData,
            role = role,
            onDismiss = { activePopupData = null }
        )
    }
}
