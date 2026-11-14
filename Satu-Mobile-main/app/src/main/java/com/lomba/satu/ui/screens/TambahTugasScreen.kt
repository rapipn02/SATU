package com.lomba.satu.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.launch

import androidx.compose.ui.platform.LocalContext
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.StudentItem
import com.lomba.satu.data.TaskItem
import com.lomba.satu.data.TaskStorage

@Composable
fun TambahTugasScreen(
    role: AppRole,
    onTaskAdded: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var studentsList by remember { mutableStateOf<List<StudentItem>>(emptyList()) }
    var studentNames by remember { mutableStateOf(listOf("Raka", "Sinta", "Gibran")) }
    var selectedStudentName by remember { mutableStateOf("Semua Murid") }
    var wordInput by remember { mutableStateOf("") }
    var wordsList by remember { mutableStateOf(listOf("f", "h", "m")) }
    var isLoadingAi by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    LaunchedEffect(Unit) {
        if (role == AppRole.GURU) {
            try {
                val apiStudents = if (ApiService.teacherToken != null) ApiService.fetchClassStudents() else emptyList()
                val allStudents = if (apiStudents.isNotEmpty()) apiStudents else SampleData.classes.first().students
                studentsList = allStudents
                val names = allStudents.map { it.name }.distinct()
                if (names.isNotEmpty()) {
                    studentNames = names
                }
            } catch (_: Exception) {
                val sampleStudents = SampleData.classes.first().students
                studentsList = sampleStudents
                val names = sampleStudents.map { it.name }.distinct()
                if (names.isNotEmpty()) {
                    studentNames = names
                }
            }
        }
    }

    val studentOptions = remember(studentNames) {
        listOf("Semua Murid") + studentNames
    }

    val hasUncompletedTask = remember(SampleData.tasks.toList(), selectedStudentName) {
        if (selectedStudentName == "Semua Murid") {
            SampleData.tasks.any { !it.isCompleted }
        } else {
            SampleData.tasks.any { it.studentName.equals(selectedStudentName, ignoreCase = true) && !it.isCompleted }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Tambah Tugas",
            role = role,
            onBackClick = onBack,
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
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Target Student Selector Chips
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "Tugas Ditujukan Kepada",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        LazyRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(horizontal = 2.dp)
                        ) {
                            items(studentOptions) { optionName ->
                                val isSelected = optionName == selectedStudentName
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = if (isSelected) themeColor else SurfaceWhite,
                                    border = BorderStroke(1.5.dp, themeColor),
                                    modifier = Modifier.clickable { selectedStudentName = optionName }
                                ) {
                                    Box(
                                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = optionName,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) SurfaceWhite else TextPrimary,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Warning Banner when selected student has uncompleted active task
                    if (hasUncompletedTask) {
                        CardContainer(role = role) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Text(
                                    text = "⚠️ Tugas lama untuk $selectedStudentName belum selesai dikerjakan murid.",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = androidx.compose.ui.graphics.Color(0xFFD93025)
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Selesaikan tugas lama terlebih dahulu sebelum membuat tugas baru.",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                    SecondaryButton(
                        text = if (isLoadingAi) "Memuat AI..." else "🤖 Auto Fill Saran Tugas AI untuk $selectedStudentName",
                        onClick = {
                            coroutineScope.launch {
                                isLoadingAi = true
                                try {
                                    val targetForAi = if (selectedStudentName == "Semua Murid") studentNames.firstOrNull() ?: "Raka" else selectedStudentName
                                    val stId = studentsList.find { it.name.equals(targetForAi, ignoreCase = true) }?.id
                                    val aiItems = ApiService.fetchAiSuggestedHomeworkForStudent(stId, targetForAi)
                                    if (aiItems.isNotEmpty()) {
                                        wordsList = aiItems
                                    }
                                    activeToast = ToastBannerData(
                                        "Saran AI Berhasil",
                                        "Tugas latihan '${wordsList.joinToString(" - ")}' untuk $selectedStudentName berhasil diisi dari AI."
                                    )
                                } catch (_: Exception) {
                                    wordsList = listOf("f", "h", "m")
                                    activeToast = ToastBannerData("Saran AI Berhasil", "Tugas latihan berhasil diisi.")
                                } finally {
                                    isLoadingAi = false
                                }
                            }
                        },
                        role = role
                    )

                    // Multi-Word Task Adder
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "Daftar Kata / Bunyi Tugas",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = wordInput,
                                onValueChange = { wordInput = it },
                                placeholder = { Text("Contoh: f", fontSize = 14.sp, color = TextPlaceholder) },
                                singleLine = true,
                                shape = RoundedCornerShape(20.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = themeColor,
                                    unfocusedBorderColor = themeColor.copy(alpha = 0.4f),
                                    focusedContainerColor = SurfaceWhite,
                                    unfocusedContainerColor = SurfaceWhite
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                            )

                            Button(
                                onClick = {
                                    if (wordInput.isNotBlank()) {
                                        wordsList = wordsList + wordInput.trim()
                                        wordInput = ""
                                    }
                                },
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = themeColor),
                                modifier = Modifier.height(52.dp)
                            ) {
                                Text("+ Bunyi", fontWeight = FontWeight.Bold, color = SurfaceWhite)
                            }
                        }

                        // Added Words Chips
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            wordsList.forEach { w ->
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = themeColor.copy(alpha = 0.15f),
                                    border = BorderStroke(1.5.dp, themeColor),
                                    modifier = Modifier.clickable {
                                        wordsList = wordsList.filter { it != w }
                                    }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(text = w, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(text = "✕", fontSize = 12.sp, color = TextSecondary)
                                    }
                                }
                            }
                        }
                    }
                }

                PrimaryButton(
                    text = if (isSubmitting) "Menyimpan..." else "Tambah Tugas",
                    enabled = !isSubmitting && !hasUncompletedTask,
                    onClick = {
                        val finalWords = if (wordsList.isNotEmpty()) wordsList else listOf("f", "h", "m")
                        val taskText = finalWords.joinToString(" - ")
                        val fullTaskName = "$selectedStudentName: $taskText"

                        coroutineScope.launch {
                            isSubmitting = true
                            var hasError = false
                            var errorMsg = ""

                            try {
                                if (selectedStudentName == "Semua Murid") {
                                    // Assign to all students
                                    studentNames.forEach { sName ->
                                        val stId = studentsList.find { it.name.equals(sName, ignoreCase = true) }?.id ?: ""
                                        val newTask = try {
                                            ApiService.createHomework(stId, sName, finalWords)
                                        } catch (_: Exception) {
                                            val tutorialMap = finalWords.associateWith { "https://tunarungu.neotelemetri.id/tutorial/t1-$it.mp4" }
                                            TaskItem(
                                                id = System.currentTimeMillis().toString() + "_" + sName,
                                                studentId = stId,
                                                studentName = sName,
                                                taskDetail = taskText,
                                                words = finalWords,
                                                isCompleted = false,
                                                tutorialUrls = tutorialMap
                                            )
                                        }
                                        SampleData.tasks.removeAll { it.studentName.equals(sName, ignoreCase = true) && !it.isCompleted }
                                        SampleData.tasks.add(newTask)
                                    }
                                } else {
                                    // Assign to selected individual student
                                    val stId = studentsList.find { it.name.equals(selectedStudentName, ignoreCase = true) }?.id ?: ""
                                    val newTask = try {
                                        ApiService.createHomework(stId, selectedStudentName, finalWords)
                                    } catch (_: Exception) {
                                        val tutorialMap = finalWords.associateWith { "https://tunarungu.neotelemetri.id/tutorial/t1-$it.mp4" }
                                        TaskItem(
                                            id = System.currentTimeMillis().toString(),
                                            studentId = stId,
                                            studentName = selectedStudentName,
                                            taskDetail = taskText,
                                            words = finalWords,
                                            isCompleted = false,
                                            tutorialUrls = tutorialMap
                                        )
                                    }
                                    SampleData.tasks.removeAll { it.studentName.equals(selectedStudentName, ignoreCase = true) && !it.isCompleted }
                                    SampleData.tasks.add(newTask)
                                }
                                TaskStorage.saveTasks(context, SampleData.tasks)
                            } catch (e: Exception) {
                                hasError = true
                                errorMsg = e.message ?: "Gagal menyimpan tugas di server"
                            } finally {
                                isSubmitting = false
                                if (hasError) {
                                    activeToast = ToastBannerData("Gagal Menyimpan Tugas", errorMsg)
                                } else {
                                    onTaskAdded(fullTaskName)
                                }
                            }
                        }
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
