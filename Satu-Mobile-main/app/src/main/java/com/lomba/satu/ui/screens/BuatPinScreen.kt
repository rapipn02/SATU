package com.lomba.satu.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.R
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

fun getPinDrawableId(number: Int): Int {
    return when (number) {
        1 -> R.drawable.p1
        2 -> R.drawable.p2
        3 -> R.drawable.p3
        4 -> R.drawable.p4
        5 -> R.drawable.p5
        6 -> R.drawable.p6
        7 -> R.drawable.p7
        8 -> R.drawable.p8
        9 -> R.drawable.p9
        else -> R.drawable.p1
    }
}

@Composable
fun BuatPinScreen(
    role: AppRole,
    onPinSaved: (List<Int>) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: String = "Buat Pin"
) {
    var selectedPinList by remember { mutableStateOf(listOf<Int>()) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = title,
            role = role,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 8.dp)
            ) {
                // Top 3 Dashed Slots
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    repeat(3) { index ->
                        val selectedNumber = selectedPinList.getOrNull(index)

                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = SurfaceWhite,
                            modifier = Modifier
                                .size(72.dp)
                                .clickable {
                                    if (selectedPinList.size > index) {
                                        selectedPinList = selectedPinList.filterIndexed { i, _ -> i != index }
                                    }
                                }
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Canvas(modifier = Modifier.fillMaxSize()) {
                                    val stroke = Stroke(
                                        width = 4f,
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f), 0f)
                                    )
                                    drawRoundRect(
                                        color = if (selectedNumber != null) themeColor else Color.LightGray,
                                        style = stroke,
                                        cornerRadius = CornerRadius(16.dp.toPx(), 16.dp.toPx())
                                    )
                                }

                                if (selectedNumber != null) {
                                    Image(
                                        painter = painterResource(id = getPinDrawableId(selectedNumber)),
                                        contentDescription = "PIN $selectedNumber",
                                        modifier = Modifier.size(44.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // 3x3 Grid of 9 PIN drawables (p1 to p9)
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(4.dp)
                ) {
                    items((1..9).toList()) { pinNumber ->
                        val interactionSource = remember { MutableInteractionSource() }
                        val isPressed by interactionSource.collectIsPressedAsState()
                        val scale by animateFloatAsState(targetValue = if (isPressed) 0.92f else 1f, label = "pinScale")

                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = SurfaceWhite,
                            border = BorderStroke(1.5.dp, themeColor.copy(alpha = 0.3f)),
                            shadowElevation = if (isPressed) 1.dp else 3.dp,
                            modifier = Modifier
                                .aspectRatio(1f)
                                .scale(scale)
                                .clickable(
                                    interactionSource = interactionSource,
                                    indication = null
                                ) {
                                    if (selectedPinList.size < 3) {
                                        selectedPinList = selectedPinList + pinNumber
                                    } else {
                                        activeToast = ToastBannerData("PIN Penuh", "PIN maksimal 3 gambar.")
                                    }
                                }
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = getPinDrawableId(pinNumber)),
                                    contentDescription = "PIN $pinNumber",
                                    modifier = Modifier.size(52.dp)
                                )
                            }
                        }
                    }
                }

                PrimaryButton(
                    text = "Simpan",
                    enabled = selectedPinList.isNotEmpty(),
                    onClick = {
                        val pinToPass = if (selectedPinList.isNotEmpty()) selectedPinList else listOf(1, 2, 3)
                        activeToast = ToastBannerData("PIN Berhasil Dibuat", "PIN gambar baru berhasil disimpan.")
                        onPinSaved(pinToPass)
                    },
                    role = role,
                    modifier = Modifier.padding(top = 12.dp)
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
