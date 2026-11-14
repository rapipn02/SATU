package com.lomba.satu.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import com.lomba.satu.data.AppRole

private val YellowColorScheme = lightColorScheme(
    primary = PrimaryYellow,
    secondary = DarkYellow,
    background = LightYellowBg,
    surface = SurfaceWhite,
    onPrimary = SurfaceWhite,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

private val OrangeColorScheme = lightColorScheme(
    primary = PrimaryOrange,
    secondary = DarkOrange,
    background = LightOrangeBg,
    surface = SurfaceWhite,
    onPrimary = SurfaceWhite,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun SatuTheme(
    role: AppRole = AppRole.GURU,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (role == AppRole.GURU) YellowColorScheme else OrangeColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
