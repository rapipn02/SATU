package com.lomba.satu.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.AppRole
import com.lomba.satu.ui.theme.PrimaryOrange
import com.lomba.satu.ui.theme.PrimaryYellow
import com.lomba.satu.ui.theme.SurfaceWhite

enum class BottomTab(val teacherTitle: String, val parentTitle: String) {
    PETA("Peta", "Beranda"),
    TUGAS("Tugas", "Progress"),
    ANAK("Anak", "Laporan"),
    AKUN("Akun", "Akun")
}

@Composable
fun AppBottomNavigationBar(
    currentTab: BottomTab,
    onTabSelected: (BottomTab) -> Unit,
    modifier: Modifier = Modifier,
    role: AppRole = AppRole.GURU
) {
    val activeColor = if (role == AppRole.GURU) PrimaryYellow else PrimaryOrange
    val inactiveColor = activeColor.copy(alpha = 0.5f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(32.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .shadow(elevation = 6.dp, shape = RoundedCornerShape(32.dp))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp, horizontal = 12.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BottomTab.entries.forEach { tab ->
                    val isSelected = tab == currentTab
                    val tint by animateColorAsState(if (isSelected) activeColor else inactiveColor, label = "tabTint")
                    val indicatorWidth by animateDpAsState(if (isSelected) 36.dp else 0.dp, label = "tabIndicator")
                    val labelText = if (role == AppRole.GURU) tab.teacherTitle else tab.parentTitle

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .clickable { onTabSelected(tab) }
                            .padding(horizontal = 12.dp, vertical = 2.dp)
                    ) {
                        // Top active tab indicator bar
                        Box(
                            modifier = Modifier
                                .height(4.dp)
                                .width(indicatorWidth)
                                .clip(RoundedCornerShape(2.dp))
                                .background(if (isSelected) activeColor else Color.Transparent)
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        when (tab) {
                            BottomTab.PETA -> IconPeta(tint = tint, modifier = Modifier.size(24.dp))
                            BottomTab.TUGAS -> IconTugas(tint = tint, modifier = Modifier.size(24.dp))
                            BottomTab.ANAK -> IconAnak(tint = tint, modifier = Modifier.size(24.dp))
                            BottomTab.AKUN -> IconAkun(tint = tint, modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = labelText,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                            color = tint
                        )
                    }
                }
            }
        }
    }
}
