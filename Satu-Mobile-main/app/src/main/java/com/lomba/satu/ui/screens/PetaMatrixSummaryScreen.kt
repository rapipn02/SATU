package com.lomba.satu.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.VowelStatus
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun PetaMatrixSummaryScreen(
    role: AppRole,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var titleName by remember { mutableStateOf(ApiService.currentClassroomName) }
    var soundsList by remember { mutableStateOf(listOf("a", "i", "u", "e", "o", "F", "H", "M")) }
    var studentsList by remember { mutableStateOf(SampleData.classes.first().students) }
    var isLoading by remember { mutableStateOf(true) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    fun reloadMatrix() {
        coroutineScope.launch {
            isLoading = true
            try {
                if (role == AppRole.GURU && ApiService.teacherToken != null) {
                    val (cName, sArr, sList) = ApiService.fetchClassSoundsMatrix()
                    titleName = cName
                    if (sArr.isNotEmpty()) soundsList = sArr
                    if (sList.isNotEmpty()) studentsList = sList
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        reloadMatrix()
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = titleName,
            role = role,
            modifier = Modifier.fillMaxSize()
        ) {
            if (isLoading && studentsList.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = themeColor)
                }
            } else {
                Column(modifier = Modifier.fillMaxSize()) {
                    val horizontalScrollState = rememberScrollState()

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .horizontalScroll(horizontalScrollState)
                    ) {
                        // Header row of sound items (a, i, u, e, o, F, H, M...)
                        Row(
                            modifier = Modifier
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Nama Anak",
                                modifier = Modifier.width(110.dp),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )

                            soundsList.forEach { sound ->
                                Text(
                                    text = sound,
                                    modifier = Modifier.width(48.dp),
                                    textAlign = TextAlign.Center,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary
                                )
                            }
                        }

                        HorizontalDivider(
                            modifier = Modifier.padding(bottom = 8.dp),
                            color = themeColor.copy(alpha = 0.4f)
                        )

                        // Matrix Rows for each student
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(bottom = 16.dp)
                        ) {
                            items(studentsList) { student ->
                                Row(
                                    modifier = Modifier.padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = student.name,
                                        modifier = Modifier.width(110.dp),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary
                                    )

                                    soundsList.forEach { sound ->
                                        val currentStatus = student.vowelsProgress[sound] ?: VowelStatus.NOT_STARTED
                                        val isMastered = currentStatus == VowelStatus.MASTERED
                                        val isPracticing = currentStatus == VowelStatus.PRACTICING

                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = when {
                                                isMastered -> themeColor
                                                isPracticing -> themeColor.copy(alpha = 0.35f)
                                                else -> SurfaceWhite
                                            },
                                            border = BorderStroke(1.5.dp, themeColor),
                                            modifier = Modifier
                                                .width(48.dp)
                                                .height(38.dp)
                                                .padding(horizontal = 3.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier.fillMaxSize(),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                if (isMastered) {
                                                    Text(
                                                        text = "✓",
                                                        color = SurfaceWhite,
                                                        fontSize = 18.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                } else if (isPracticing) {
                                                    Text(
                                                        text = "?",
                                                        color = TextPrimary,
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
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
}
