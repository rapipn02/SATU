package com.lomba.satu.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.R
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun KendaliManualScreen(
    role: AppRole,
    onResetPinClick: () -> Unit,
    onBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Kendali Manual",
            role = role,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Card: Reset Pin
                CardContainer(
                    role = role,
                    onClick = onResetPinClick
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                modifier = Modifier.size(52.dp),
                                shape = RoundedCornerShape(16.dp),
                                color = themeColor
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Image(
                                        painter = painterResource(id = R.drawable.p1),
                                        contentDescription = "Reset Pin",
                                        modifier = Modifier.size(30.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(16.dp))

                            Text(
                                text = "Reset Pin",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                        IconChevronRight(tint = TextPrimary)
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
