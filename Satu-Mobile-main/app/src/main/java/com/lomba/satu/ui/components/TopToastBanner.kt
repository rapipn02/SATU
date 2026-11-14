package com.lomba.satu.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.R
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.delay

data class ToastBannerData(
    val title: String,
    val message: String,
    val id: Long = System.currentTimeMillis()
)

@Composable
fun TopToastBanner(
    data: ToastBannerData?,
    modifier: Modifier = Modifier,
    role: AppRole = AppRole.GURU,
    onDismiss: () -> Unit
) {
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    LaunchedEffect(data?.id) {
        if (data != null) {
            delay(2600) // Auto-hide after 2.6 seconds
            onDismiss()
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 16.dp, start = 16.dp, end = 16.dp),
        contentAlignment = Alignment.TopCenter
    ) {
        AnimatedVisibility(
            visible = data != null,
            enter = slideInVertically(
                initialOffsetY = { -it - 60 },
                animationSpec = tween(durationMillis = 350)
            ) + fadeIn(animationSpec = tween(durationMillis = 350)),
            exit = slideOutVertically(
                targetOffsetY = { -it - 60 },
                animationSpec = tween(durationMillis = 300)
            ) + fadeOut(animationSpec = tween(durationMillis = 300))
        ) {
            data?.let { banner ->
                Surface(
                    shape = RoundedCornerShape(24.dp),
                    color = SurfaceWhite,
                    border = BorderStroke(1.5.dp, themeColor),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(elevation = 8.dp, shape = RoundedCornerShape(24.dp))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Small Mascot Icon Badge
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = themeColor.copy(alpha = 0.15f),
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Image(
                                    painter = painterResource(id = R.drawable.logoapp),
                                    contentDescription = "SATU Logo",
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = banner.title,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            if (banner.message.isNotBlank()) {
                                Text(
                                    text = banner.message,
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
    }
}
