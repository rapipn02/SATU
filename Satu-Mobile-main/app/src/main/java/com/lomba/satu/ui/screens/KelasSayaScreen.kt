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
import com.lomba.satu.data.SampleData
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.PrimaryOrange
import com.lomba.satu.ui.theme.PrimaryYellow
import com.lomba.satu.ui.theme.TextPrimary
import com.lomba.satu.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun KelasSayaScreen(
    role: AppRole,
    onClassSelected: (ClassItem) -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var classesList by remember { mutableStateOf(SampleData.classes) }
    var showAddClassDialog by remember { mutableStateOf(false) }
    var newClassName by remember { mutableStateOf("") }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    LaunchedEffect(Unit) {
        if (role == AppRole.GURU && ApiService.teacherToken != null) {
            try {
                val apiClasses = ApiService.fetchClassroomsList()
                if (apiClasses.isNotEmpty()) {
                    classesList = apiClasses
                }
            } catch (_: Exception) {}
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Kelas Saya",
            role = role,
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
                    items(classesList) { classItem ->
                        CardContainer(
                            role = role,
                            onClick = { onClassSelected(classItem) }
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = classItem.name,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "${classItem.studentCount} anak",
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

                // Bottom action button: "Tambah Kelas"
                PrimaryButton(
                    text = "Tambah Kelas",
                    onClick = { showAddClassDialog = true },
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

    if (showAddClassDialog) {
        AlertDialog(
            onDismissRequest = { showAddClassDialog = false },
            title = { Text("Tambah Kelas Baru", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = newClassName,
                    onValueChange = { newClassName = it },
                    label = { Text("Nama Kelas") },
                    placeholder = { Text("Contoh: Kelas E") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newClassName.isNotBlank()) {
                            val nameToSubmit = newClassName
                            coroutineScope.launch {
                                try {
                                    if (role == AppRole.GURU && ApiService.teacherToken != null) {
                                        val newClass = ApiService.createClassroom(nameToSubmit)
                                        classesList = classesList + newClass
                                    } else {
                                        val newClass = ClassItem(
                                            id = System.currentTimeMillis().toString(),
                                            name = nameToSubmit,
                                            studentCount = 0
                                        )
                                        classesList = classesList + newClass
                                    }
                                } catch (_: Exception) {
                                    val newClass = ClassItem(
                                        id = System.currentTimeMillis().toString(),
                                        name = nameToSubmit,
                                        studentCount = 0
                                    )
                                    classesList = classesList + newClass
                                }
                            }
                            newClassName = ""
                            showAddClassDialog = false
                            activeToast = ToastBannerData(
                                title = "Kelas Ditambahkan",
                                message = "Kelas '$nameToSubmit' berhasil dibuat."
                            )
                        }
                    }
                ) {
                    Text("Tambah", color = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddClassDialog = false }) {
                    Text("Batal", color = TextSecondary)
                }
            }
        )
    }
}
