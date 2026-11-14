package com.lomba.satu.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun AkunScreen(
    currentRole: AppRole,
    onRoleToggle: (AppRole) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isLogoutConfirmState by remember { mutableStateOf(false) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    val themeColor = if (currentRole == AppRole.GURU) PrimaryYellow else PrimaryOrange

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Akun",
            role = currentRole,
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
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    if (!isLogoutConfirmState) {
                        // Profile Info Card
                        CardContainer(role = currentRole) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    modifier = Modifier.size(52.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    color = SurfaceWhite,
                                    border = BorderStroke(2.dp, themeColor)
                                ) {
                                    IconAkun(
                                        tint = themeColor,
                                        modifier = Modifier
                                            .padding(8.dp)
                                            .size(32.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(16.dp))

                                Column {
                                    Text(
                                        text = ApiService.teacherName,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = ApiService.teacherEmail,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }

                // Bottom Buttons: Logout / Confirmation Buttons ("Keluar" and "Batal")
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (!isLogoutConfirmState) {
                        androidx.compose.material3.Button(
                            onClick = { isLogoutConfirmState = true },
                            shape = RoundedCornerShape(14.dp),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEA4335),
                                contentColor = SurfaceWhite
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                        ) {
                            Text("Keluar", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = SurfaceWhite)
                        }
                    } else {
                        androidx.compose.material3.Button(
                            onClick = {
                                activeToast = ToastBannerData("Berhasil Keluar", "Anda telah keluar dari aplikasi Satu.")
                                onLogout()
                            },
                            shape = RoundedCornerShape(14.dp),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEA4335),
                                contentColor = SurfaceWhite
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                        ) {
                            Text("Keluar", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = SurfaceWhite)
                        }

                        SecondaryButton(
                            text = "Batal",
                            onClick = { isLogoutConfirmState = false },
                            role = currentRole
                        )
                    }
                }
            }
        }

        TopToastBanner(
            data = activeToast,
            role = currentRole,
            onDismiss = { activeToast = null }
        )
    }
}
