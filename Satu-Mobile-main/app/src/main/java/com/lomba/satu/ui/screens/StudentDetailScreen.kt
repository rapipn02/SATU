package com.lomba.satu.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.StudentItem
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*

@Composable
fun StudentDetailScreen(
    student: StudentItem,
    role: AppRole,
    onReportClick: () -> Unit,
    onKendaliManualClick: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    MascotHeader(
        title = student.name,
        role = role,
        onBackClick = onBack,
        modifier = modifier
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
                // Pin Anak Card (Real 3-PIN images p2, p5, p8)
                CardContainer(role = role) {
                    Column {
                        Text(
                            text = "Pin Anak",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val pinList = if (student.picturePassword.isNotEmpty()) student.picturePassword else {
                                if (student.name.equals("Gibran", ignoreCase = true)) listOf(1, 5, 3) else listOf(2, 5, 8)
                            }
                            val pin1 = pinList.getOrNull(0) ?: 1
                            val pin2 = pinList.getOrNull(1) ?: 5
                            val pin3 = pinList.getOrNull(2) ?: 3

                            Image(
                                painter = painterResource(id = getPinDrawableId(pin1)),
                                contentDescription = "PIN $pin1",
                                modifier = Modifier.size(54.dp)
                            )
                            Image(
                                painter = painterResource(id = getPinDrawableId(pin2)),
                                contentDescription = "PIN $pin2",
                                modifier = Modifier.size(54.dp)
                            )
                            Image(
                                painter = painterResource(id = getPinDrawableId(pin3)),
                                contentDescription = "PIN $pin3",
                                modifier = Modifier.size(54.dp)
                            )
                        }
                    }
                }
            }

            // Bottom action buttons: "Report Perkembangan" and "Kendali Manual"
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                PrimaryButton(
                    text = "Report Perkembangan",
                    onClick = onReportClick,
                    role = role
                )

                SecondaryButton(
                    text = "Kendali Manual",
                    onClick = onKendaliManualClick,
                    role = role
                )
            }
        }
    }
}
