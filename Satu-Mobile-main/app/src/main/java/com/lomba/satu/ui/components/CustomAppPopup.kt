package com.lomba.satu.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.lomba.satu.R
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.theme.*

data class PopupData(
    val title: String,
    val message: String,
    val isSuccess: Boolean = true,
    val onConfirm: (() -> Unit)? = null
)

@Composable
fun CustomAppPopup(
    data: PopupData,
    role: AppRole,
    onDismiss: () -> Unit
) {
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val cardBg = if (role == AppRole.GURU) LightYellowBg else LightOrangeBg

    Dialog(onDismissRequest = onDismiss) {
        AnimatedVisibility(
            visible = true,
            enter = fadeIn() + scaleIn(animationSpec = spring(dampingRatio = 0.6f)),
            exit = fadeOut() + scaleOut()
        ) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = cardBg,
                border = BorderStroke(2.dp, themeColor),
                shadowElevation = 8.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // App Logo Header Image
                    Image(
                        painter = painterResource(id = R.drawable.logoapp),
                        contentDescription = "SATU Logo",
                        modifier = Modifier
                            .height(64.dp)
                            .padding(bottom = 12.dp)
                    )

                    // Title
                    Text(
                        text = data.title,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    // Message
                    Text(
                        text = data.message,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(bottom = 20.dp)
                    )

                    // Confirm Action Button
                    PrimaryButton(
                        text = "OK",
                        onClick = {
                            data.onConfirm?.invoke()
                            onDismiss()
                        },
                        role = role
                    )
                }
            }
        }
    }
}
