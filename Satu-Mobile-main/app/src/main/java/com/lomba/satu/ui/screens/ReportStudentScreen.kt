package com.lomba.satu.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.StudentItem
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun CustomProgressBar(
    progressFraction: Float,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(10.dp)
            .background(color.copy(alpha = 0.2f), RoundedCornerShape(5.dp))
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(progressFraction.coerceIn(0.02f, 1.0f))
                .background(color, RoundedCornerShape(5.dp))
        )
    }
}

@Composable
fun ReportStudentScreen(
    student: StudentItem,
    role: AppRole,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var studentReportData by remember { mutableStateOf(student) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    LaunchedEffect(student.id) {
        if (role == AppRole.GURU && ApiService.teacherToken != null) {
            try {
                val rep = ApiService.fetchStudentReport(student.id)
                studentReportData = rep
            } catch (_: Exception) {}
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Report ${studentReportData.name}",
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
                    // Top 3 Stat Cards Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        StatBadge(
                            value = "${studentReportData.practiceDays7}/7",
                            label = "Hari latihan",
                            modifier = Modifier.weight(1f),
                            role = role
                        )
                        StatBadge(
                            value = "⭐ ${studentReportData.totalPoints}",
                            label = "Poin",
                            modifier = Modifier.weight(1f),
                            role = role
                        )
                        StatBadge(
                            value = "🔥 ${studentReportData.streakDays}",
                            label = "Poin",
                            modifier = Modifier.weight(1f),
                            role = role
                        )
                    }

                    // Perkembangan Bicara Line Chart Card (Sumbu X: Hari, Sumbu Y: Akurasi %)
                    CardContainer(role = role) {
                        Column {
                            Text(
                                text = "Grafik Perkembangan Bicara (%)",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(12.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(130.dp)
                            ) {
                                // Sumbu Y (100%, 75%, 50%, 25%, 0%)
                                Column(
                                    modifier = Modifier
                                        .fillMaxHeight()
                                        .padding(end = 8.dp),
                                    verticalArrangement = Arrangement.SpaceBetween,
                                    horizontalAlignment = Alignment.End
                                ) {
                                    listOf("100%", "75%", "50%", "25%", "0%").forEach { yLabel ->
                                        Text(text = yLabel, fontSize = 10.sp, color = TextSecondary)
                                    }
                                }

                                // Custom Line Chart Graphic Area
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                ) {
                                    Canvas(modifier = Modifier.fillMaxSize()) {
                                        val w = size.width
                                        val h = size.height

                                        // Horizontal grid lines
                                        drawLine(Color.LightGray.copy(alpha = 0.5f), Offset(0f, 0f), Offset(w, 0f), strokeWidth = 1.5f)
                                        drawLine(Color.LightGray.copy(alpha = 0.5f), Offset(0f, h * 0.25f), Offset(w, h * 0.25f), strokeWidth = 1.5f)
                                        drawLine(Color.LightGray.copy(alpha = 0.5f), Offset(0f, h * 0.50f), Offset(w, h * 0.50f), strokeWidth = 1.5f)
                                        drawLine(Color.LightGray.copy(alpha = 0.5f), Offset(0f, h * 0.75f), Offset(w, h * 0.75f), strokeWidth = 1.5f)
                                        drawLine(Color.LightGray.copy(alpha = 0.5f), Offset(0f, h), Offset(w, h), strokeWidth = 1.5f)

                                        // Dynamic Accuracy rates: 35% -> 55% -> 80% -> 92%
                                        val rates = listOf(0.35f, 0.55f, 0.80f, 0.92f)
                                        val xPos = listOf(0.05f, 0.35f, 0.65f, 0.95f)

                                        val points = rates.mapIndexed { idx, rate ->
                                            Offset(w * xPos[idx], h * (1f - rate))
                                        }

                                        val linePath = Path().apply {
                                            moveTo(points[0].x, points[0].y)
                                            cubicTo(
                                                (points[0].x + points[1].x) / 2, points[0].y,
                                                (points[0].x + points[1].x) / 2, points[1].y,
                                                points[1].x, points[1].y
                                            )
                                            cubicTo(
                                                (points[1].x + points[2].x) / 2, points[1].y,
                                                (points[1].x + points[2].x) / 2, points[2].y,
                                                points[2].x, points[2].y
                                            )
                                            cubicTo(
                                                (points[2].x + points[3].x) / 2, points[2].y,
                                                (points[2].x + points[3].x) / 2, points[3].y,
                                                points[3].x, points[3].y
                                            )
                                        }

                                        drawPath(linePath, color = themeColor, style = Stroke(width = 6f))

                                        points.forEach { pt ->
                                            drawCircle(color = SurfaceWhite, radius = 10f, center = pt)
                                            drawCircle(color = themeColor, radius = 6f, center = pt)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            // Sumbu X (Senin - Kamis)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 36.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                listOf("Senin", "Selasa", "Rabu", "Kamis").forEach { day ->
                                    Text(text = day, fontSize = 11.sp, color = TextSecondary)
                                }
                            }
                        }
                    }

                    // Multi-Level Progress Bars: "Sudah Bisa", "Sedang Dilatih", "Belum Dilatih"
                    Text(
                        text = "Tahap Penguasaan Bunyi & Kata",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    val vowelsMap = studentReportData.vowelsProgress
                    val totalSounds = vowelsMap.size.coerceAtLeast(1)
                    val masteredList = vowelsMap.filterValues { it == com.lomba.satu.data.VowelStatus.MASTERED }.keys.toList()
                    val practicingList = vowelsMap.filterValues { it == com.lomba.satu.data.VowelStatus.PRACTICING }.keys.toList()
                    val notStartedList = vowelsMap.filterValues { it == com.lomba.satu.data.VowelStatus.NOT_STARTED }.keys.toList()

                    val masteredPct = (masteredList.size * 100) / totalSounds
                    val practicingPct = (practicingList.size * 100) / totalSounds
                    val notStartedPct = (100 - masteredPct - practicingPct).coerceAtLeast(0)

                    val masteredStr = if (masteredList.isNotEmpty()) masteredList.joinToString(" - ") else "-"
                    val practicingStr = if (practicingList.isNotEmpty()) practicingList.joinToString(" - ") else "-"
                    val notStartedStr = if (notStartedList.isNotEmpty()) notStartedList.joinToString(" - ") else "-"

                    // 1. Sudah Bisa Card
                    CardContainer(role = role) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "✓  Sudah Bisa ($masteredStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$masteredPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = themeColor
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (masteredList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = themeColor)
                        }
                    }

                    // 2. Sedang Dilatih Card
                    CardContainer(role = role) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "?  Sedang Dilatih ($practicingStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$practicingPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = themeColor
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (practicingList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = themeColor)
                        }
                    }

                    // 3. Belum Dilatih Card
                    CardContainer(role = role) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "•  Belum Dilatih ($notStartedStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$notStartedPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextSecondary
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (notStartedList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = themeColor.copy(alpha = 0.6f))
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

@Composable
private fun StatBadge(
    value: String,
    label: String,
    role: AppRole,
    modifier: Modifier = Modifier
) {
    CardContainer(role = role, modifier = modifier) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                fontSize = 11.sp,
                color = TextSecondary,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
