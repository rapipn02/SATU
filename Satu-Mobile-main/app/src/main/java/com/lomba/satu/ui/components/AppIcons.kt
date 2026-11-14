package com.lomba.satu.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun IconPeta(tint: Color, modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = w * 0.1f)
        
        // Folded Map representation
        val path = Path().apply {
            moveTo(w * 0.15f, h * 0.25f)
            lineTo(w * 0.45f, h * 0.15f)
            lineTo(w * 0.75f, h * 0.25f)
            lineTo(w * 0.75f, h * 0.85f)
            lineTo(w * 0.45f, h * 0.75f)
            lineTo(w * 0.15f, h * 0.85f)
            close()
        }
        drawPath(path, color = tint, style = stroke)
        drawLine(tint, Offset(w * 0.45f, h * 0.15f), Offset(w * 0.45f, h * 0.75f), strokeWidth = w * 0.08f)
    }
}

@Composable
fun IconTugas(tint: Color, modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = w * 0.09f)

        // Clipboard
        drawRoundRect(
            color = tint,
            topLeft = Offset(w * 0.2f, h * 0.25f),
            size = Size(w * 0.6f, h * 0.65f),
            style = stroke
        )
        // Checkmark inside
        val checkPath = Path().apply {
            moveTo(w * 0.35f, h * 0.55f)
            lineTo(w * 0.47f, h * 0.67f)
            lineTo(w * 0.65f, h * 0.42f)
        }
        drawPath(checkPath, color = tint, style = stroke)
    }
}

@Composable
fun IconAnak(tint: Color, modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height

        // Left figure head & body
        drawCircle(color = tint, radius = w * 0.12f, center = Offset(w * 0.35f, h * 0.28f))
        val body1 = Path().apply {
            moveTo(w * 0.22f, h * 0.85f)
            lineTo(w * 0.35f, h * 0.48f)
            lineTo(w * 0.48f, h * 0.85f)
        }
        drawPath(body1, color = tint, style = Stroke(width = w * 0.1f))

        // Right figure head & body
        drawCircle(color = tint, radius = w * 0.12f, center = Offset(w * 0.65f, h * 0.28f))
        val body2 = Path().apply {
            moveTo(w * 0.52f, h * 0.85f)
            lineTo(w * 0.65f, h * 0.48f)
            lineTo(w * 0.78f, h * 0.85f)
        }
        drawPath(body2, color = tint, style = Stroke(width = w * 0.1f))
    }
}

@Composable
fun IconAkun(tint: Color, modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = w * 0.09f)

        drawCircle(color = tint, center = Offset(w * 0.5f, h * 0.5f), radius = w * 0.42f, style = stroke)
        drawCircle(color = tint, center = Offset(w * 0.5f, h * 0.38f), radius = w * 0.16f)

        val body = Path().apply {
            moveTo(w * 0.25f, h * 0.8f)
            cubicTo(
                w * 0.35f, h * 0.62f,
                w * 0.65f, h * 0.62f,
                w * 0.75f, h * 0.8f
            )
        }
        drawPath(body, color = tint, style = stroke)
    }
}

@Composable
fun IconChevronRight(tint: Color = Color(0xFF333333), modifier: Modifier = Modifier.size(20.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(w * 0.35f, h * 0.2f)
            lineTo(w * 0.68f, h * 0.5f)
            lineTo(w * 0.35f, h * 0.8f)
        }
        drawPath(path, color = tint, style = Stroke(width = w * 0.12f))
    }
}

@Composable
fun IconBackArrow(tint: Color = Color(0xFF333333), modifier: Modifier = Modifier.size(24.dp)) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = w * 0.12f)
        val path = Path().apply {
            moveTo(w * 0.55f, h * 0.25f)
            lineTo(w * 0.3f, h * 0.5f)
            lineTo(w * 0.55f, h * 0.75f)
        }
        drawPath(path, color = tint, style = stroke)
        drawLine(color = tint, start = Offset(w * 0.3f, h * 0.5f), end = Offset(w * 0.75f, h * 0.5f), strokeWidth = w * 0.12f)
    }
}

@Composable
fun LogoOutlook(size: Dp = 44.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Color(0xFFEAF2FF)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(size * 0.65f)
                .background(Color(0xFF0078D4), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text("O", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

@Composable
fun LogoGmail(size: Dp = 44.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Color(0xFFFEEBF0)),
        contentAlignment = Alignment.Center
    ) {
        Text("M", color = Color(0xFFEA4335), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
    }
}

@Composable
fun LogoGoogle(size: Dp = 44.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Color(0xFFF1F3F4)),
        contentAlignment = Alignment.Center
    ) {
        Text("G", color = Color(0xFF4285F4), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
    }
}
