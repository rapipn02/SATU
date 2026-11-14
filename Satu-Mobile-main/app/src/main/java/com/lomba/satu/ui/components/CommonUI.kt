package com.lomba.satu.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.theme.*

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    role: AppRole = AppRole.GURU,
    enabled: Boolean = true
) {
    val btnColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.96f else 1f, label = "btnScale")

    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = btnColor,
            contentColor = SurfaceWhite
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 2.dp,
            pressedElevation = 0.dp
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .scale(scale)
    ) {
        Text(
            text = text,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = SurfaceWhite
        )
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    role: AppRole = AppRole.GURU
) {
    val borderColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.96f else 1f, label = "secBtnScale")

    OutlinedButton(
        onClick = onClick,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.5.dp, borderColor),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = SurfaceWhite,
            contentColor = borderColor
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .scale(scale)
    ) {
        Text(
            text = text,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = borderColor
        )
    }
}

@Composable
fun CustomTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    role: AppRole = AppRole.GURU,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    val focusBorderColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val labelColor = if (role == AppRole.WALI_MURID) PrimaryOrange else TextPrimary

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = labelColor,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, color = TextPlaceholder, fontSize = 14.sp) },
            singleLine = true,
            visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = focusBorderColor,
                unfocusedBorderColor = Color.Transparent,
                focusedContainerColor = SurfaceWhite,
                unfocusedContainerColor = SurfaceWhite,
                cursorColor = focusBorderColor
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .background(SurfaceWhite, RoundedCornerShape(24.dp))
        )
    }
}

@Composable
fun DashedUploadBox(
    label: String = "Foto",
    role: AppRole = AppRole.GURU,
    onClick: () -> Unit
) {
    val themeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        Surface(
            shape = RoundedCornerShape(18.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .height(130.dp)
                .clickable { onClick() }
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val stroke = Stroke(
                        width = 4f,
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(16f, 16f), 0f)
                    )
                    drawRoundRect(
                        color = themeColor,
                        style = stroke,
                        cornerRadius = CornerRadius(18.dp.toPx(), 18.dp.toPx())
                    )
                }

                // Upload image icon (landscape frame with arrow up)
                Canvas(modifier = Modifier.size(40.dp)) {
                    val w = size.width
                    val h = size.height
                    val s = Stroke(width = w * 0.08f)

                    // Image outline
                    drawRoundRect(color = themeColor, style = s, cornerRadius = CornerRadius(w * 0.15f))
                    // Mountain/sun inside
                    drawCircle(color = themeColor, radius = w * 0.1f, center = Offset(w * 0.35f, h * 0.4f))
                    // Arrow up inside
                    val arrow = Path().apply {
                        moveTo(w * 0.5f, h * 0.65f)
                        lineTo(w * 0.5f, h * 0.35f)
                        moveTo(w * 0.38f, h * 0.47f)
                        lineTo(w * 0.5f, h * 0.35f)
                        lineTo(w * 0.62f, h * 0.47f)
                    }
                    drawPath(arrow, color = themeColor, style = s)
                }
            }
        }
    }
}

@Composable
fun CardContainer(
    modifier: Modifier = Modifier,
    role: AppRole = AppRole.GURU,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val borderColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed && onClick != null) 0.97f else 1f, label = "cardScale")

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = SurfaceWhite,
        border = BorderStroke(1.5.dp, borderColor),
        shadowElevation = if (isPressed) 1.dp else 2.dp,
        modifier = modifier
            .fillMaxWidth()
            .scale(scale)
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = interactionSource,
                        indication = ripple(),
                        onClick = onClick
                    )
                } else Modifier
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            content()
        }
    }
}
