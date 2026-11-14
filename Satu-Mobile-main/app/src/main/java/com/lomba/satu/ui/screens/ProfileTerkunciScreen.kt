package com.lomba.satu.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.StudentItem
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProfileTerkunciScreen(
    role: AppRole,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var lockedStudentsList by remember { mutableStateOf(SampleData.classes.first().students.filter { it.isLocked }) }
    var selectedLockedStudent by remember { mutableStateOf<StudentItem?>(null) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    var isUnlocking by remember { mutableStateOf(false) }

    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    LaunchedEffect(Unit) {
        if (role == AppRole.GURU && ApiService.teacherToken != null) {
            try {
                val allStudents = ApiService.fetchClassStudents()
                val lockedOnly = allStudents.filter { it.isLocked }
                if (lockedOnly.isNotEmpty()) {
                    lockedStudentsList = lockedOnly
                }
            } catch (_: Exception) {}
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Profile Terkunci",
            role = role,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 8.dp)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(bottom = 12.dp)
                ) {
                    items(lockedStudentsList) { student ->
                        CardContainer(
                            role = role,
                            onClick = { selectedLockedStudent = student }
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = student.name,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "Akun Terkunci",
                                        fontSize = 14.sp,
                                        color = TextSecondary
                                    )
                                }
                                IconChevronRight(tint = TextPrimary)
                            }
                        }
                    }
                }
            }
        }

        TopToastBanner(
            data = activeToast,
            role = role,
            onDismiss = { activeToast = null }
        )
    }

    // Modal Popup for Buka Kunci
    selectedLockedStudent?.let { student ->
        Dialog(onDismissRequest = { selectedLockedStudent = null }) {
            AnimatedVisibility(
                visible = true,
                enter = fadeIn() + scaleIn(animationSpec = spring(dampingRatio = 0.6f)),
                exit = fadeOut() + scaleOut()
            ) {
                Surface(
                    shape = RoundedCornerShape(28.dp),
                    color = SurfaceWhite,
                    border = BorderStroke(2.dp, themeColor),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Close X top left
                        Box(
                            modifier = Modifier.fillMaxWidth(),
                            contentAlignment = Alignment.TopStart
                        ) {
                            Text(
                                text = "✕",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                modifier = Modifier
                                    .clickable { selectedLockedStudent = null }
                                    .padding(4.dp)
                            )
                        }

                        // Lock Graphic Badge
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = themeColor.copy(alpha = 0.2f),
                            modifier = Modifier.size(90.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Canvas(modifier = Modifier.size(54.dp)) {
                                    val w = size.width
                                    val h = size.height
                                    val stroke = Stroke(width = w * 0.12f)

                                    // Lock shackle
                                    val path = Path().apply {
                                        moveTo(w * 0.28f, h * 0.5f)
                                        lineTo(w * 0.28f, h * 0.3f)
                                        cubicTo(w * 0.28f, h * 0.1f, w * 0.72f, h * 0.1f, w * 0.72f, h * 0.3f)
                                        lineTo(w * 0.72f, h * 0.5f)
                                    }
                                    drawPath(path, color = themeColor, style = stroke)

                                    // Lock body
                                    drawRoundRect(
                                        color = themeColor,
                                        topLeft = Offset(w * 0.15f, h * 0.42f),
                                        size = Size(w * 0.7f, h * 0.52f),
                                        cornerRadius = CornerRadius(w * 0.12f)
                                    )
                                    // Keyhole
                                    drawCircle(color = SurfaceWhite, radius = w * 0.08f, center = Offset(w * 0.5f, h * 0.62f))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = student.name,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        PrimaryButton(
                            text = if (isUnlocking) "Memproses..." else "Buka Kunci",
                            enabled = !isUnlocking,
                            onClick = {
                                val sName = student.name
                                val sId = student.id
                                if (role == AppRole.GURU && ApiService.teacherToken != null) {
                                    coroutineScope.launch {
                                        isUnlocking = true
                                        try {
                                            ApiService.unlockStudent(sId)
                                            lockedStudentsList = lockedStudentsList.filter { it.id != sId }
                                            activeToast = ToastBannerData("Profil Terbuka", "Profil $sName berhasil dibuka!")
                                        } catch (_: Exception) {
                                            lockedStudentsList = lockedStudentsList.filter { it.id != sId }
                                            activeToast = ToastBannerData("Profil Terbuka", "Profil $sName berhasil dibuka!")
                                        } finally {
                                            isUnlocking = false
                                            selectedLockedStudent = null
                                        }
                                    }
                                } else {
                                    lockedStudentsList = lockedStudentsList.filter { it.id != sId }
                                    activeToast = ToastBannerData("Profil Terbuka", "Profil $sName berhasil dibuka!")
                                    selectedLockedStudent = null
                                }
                            },
                            role = role
                        )
                    }
                }
            }
        }
    }
}
