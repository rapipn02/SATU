package com.lomba.satu.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.TaskStorage
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun TugasHarianScreen(
    role: AppRole,
    onTambahTugasClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val tasksList = SampleData.tasks
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    LaunchedEffect(Unit) {
        if (SampleData.tasks.isEmpty()) {
            val saved = TaskStorage.loadTasks(context)
            if (saved.isNotEmpty()) {
                SampleData.tasks.addAll(saved)
            }
        }
        if (role == AppRole.GURU && ApiService.teacherToken != null) {
            try {
                val apiTasks = ApiService.fetchHomeworkTasks()
                if (apiTasks.isNotEmpty()) {
                    val localTaskIds = SampleData.tasks.map { it.id }.toSet()
                    apiTasks.forEach { task ->
                        if (!localTaskIds.contains(task.id)) {
                            SampleData.tasks.add(task)
                        }
                    }
                    TaskStorage.saveTasks(context, SampleData.tasks)
                }
            } catch (_: Exception) {}
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Tugas Harian",
            role = role,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 8.dp)
            ) {
                if (tasksList.isEmpty()) {
                    // Empty state when no homework has been created
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        CardContainer(role = role) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "Belum Ada Tugas Harian",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Klik 'Tambah Tugas' di bawah untuk membuat tugas harian baru untuk murid.",
                                    fontSize = 13.sp,
                                    color = TextSecondary,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = PaddingValues(bottom = 8.dp)
                    ) {
                        items(tasksList, key = { it.id }) { task ->
                            CardContainer(
                                role = role,
                                onClick = {
                                    val index = SampleData.tasks.indexOfFirst { it.id == task.id }
                                    if (index != -1) {
                                        SampleData.tasks[index] = task.copy(isSent = !task.isSent, isCompleted = false)
                                        TaskStorage.saveTasks(context, SampleData.tasks)
                                    }
                                }
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        modifier = Modifier.size(44.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        color = if (task.isSent) themeColor else SurfaceWhite,
                                        border = BorderStroke(2.dp, themeColor)
                                    ) {
                                        if (task.isSent) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text("✓", color = SurfaceWhite, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.width(16.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "Tugas Murid: ${task.studentName}",
                                                fontSize = 17.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextPrimary
                                            )
                                            if (task.isSent) {
                                                Surface(
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = themeColor.copy(alpha = 0.2f),
                                                    modifier = Modifier.padding(start = 4.dp)
                                                ) {
                                                    Text(
                                                        text = "Terkirim",
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = TextPrimary,
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Latihan: ${task.taskDetail}",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary.copy(alpha = 0.85f)
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = "📹 Video tutorial mulut siap",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Bottom action buttons: "Kirim Tugas" and "Tambah Tugas"
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PrimaryButton(
                        text = "Kirim Tugas",
                        enabled = tasksList.isNotEmpty(),
                        onClick = {
                            SampleData.tasks.forEachIndexed { idx, t ->
                                SampleData.tasks[idx] = t.copy(isSent = true, isCompleted = false)
                            }
                            TaskStorage.saveTasks(context, SampleData.tasks)
                            activeToast = ToastBannerData("Tugas Terkirim", "Semua tugas harian murid telah dikirim ke orang tua.")
                        },
                        role = role
                    )

                    SecondaryButton(
                        text = "Tambah Tugas",
                        onClick = onTambahTugasClick,
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
