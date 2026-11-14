package com.lomba.satu.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.ClassItem
import com.lomba.satu.data.StudentItem
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun KelasDetailScreen(
    classItem: ClassItem,
    role: AppRole,
    onStudentSelected: (StudentItem) -> Unit,
    onAddStudentClick: () -> Unit,
    onProfileTerkunciClick: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var studentsList by remember { mutableStateOf(classItem.students) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    LaunchedEffect(classItem.id) {
        if (role == AppRole.GURU && ApiService.teacherToken != null) {
            try {
                val apiStudents = ApiService.fetchClassStudents(classItem.id)
                if (apiStudents.isNotEmpty()) {
                    studentsList = apiStudents
                }
            } catch (_: Exception) {}
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = classItem.name,
            role = role,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 8.dp)
            ) {
                // Scrollable Student List
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(bottom = 8.dp)
                ) {
                    items(studentsList) { student ->
                        CardContainer(
                            role = role,
                            onClick = { onStudentSelected(student) }
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
                                        color = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = student.lastSession,
                                        fontSize = 14.sp,
                                        color = if (role == AppRole.WALI_MURID) PrimaryOrange.copy(alpha = 0.8f) else TextSecondary
                                    )
                                }
                                IconChevronRight(
                                    tint = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary
                                )
                            }
                        }
                    }
                }

                // Bottom Action Buttons: "Tambah Anak" and "Profile Terkunci"
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PrimaryButton(
                        text = "Tambah Anak",
                        onClick = onAddStudentClick,
                        role = role
                    )

                    SecondaryButton(
                        text = "Profile Terkunci",
                        onClick = onProfileTerkunciClick,
                        role = role
                    )
                }
            }
        }

        TopToastBanner(
            data = activeToast,
            role = role,
            onDismiss = { activeToast = null }
        )
    }
}
