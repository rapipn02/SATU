package com.lomba.satu.data

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.snapshots.SnapshotStateList

enum class AppRole {
    GURU,
    WALI_MURID
}

enum class VowelStatus {
    NOT_STARTED,
    PRACTICING,
    MASTERED
}

data class ChartDay(
    val dayLabel: String,
    val rate: Float
)

data class StudentItem(
    val id: String,
    val name: String,
    val lastSession: String = "Aktif",
    val picturePassword: List<Int> = listOf(2, 5, 8),
    val vowelsProgress: Map<String, VowelStatus> = mapOf(
        "a" to VowelStatus.MASTERED,
        "i" to VowelStatus.MASTERED,
        "u" to VowelStatus.MASTERED,
        "e" to VowelStatus.MASTERED,
        "o" to VowelStatus.MASTERED,
        "F" to VowelStatus.PRACTICING,
        "H" to VowelStatus.NOT_STARTED,
        "M" to VowelStatus.NOT_STARTED
    ),
    val masteredText: String = "a - i - u - e - o",
    val almostMasteredText: String = "F",
    val inTrainingText: String = "F",
    val historyText: String = "Kemarin / e /",
    val isLocked: Boolean = false,
    val totalPoints: Int = 180,
    val practiceDays7: Int = 5,
    val streakDays: Int = 4
)

data class ClassItem(
    val id: String,
    val name: String,
    val studentCount: Int = 1,
    val students: List<StudentItem> = listOf(
        StudentItem("3218fcaa-cd88-4aba-91da-37fd561c02d2", "Raka", "Aktif", picturePassword = listOf(2, 5, 8), isLocked = false)
    )
)

data class TaskItem(
    val id: String,
    val studentId: String = "",
    val studentName: String,
    val taskDetail: String,
    val words: List<String> = listOf("f", "h", "m"),
    var isSent: Boolean = true,
    var isCompleted: Boolean = false,
    val tutorialUrls: Map<String, String> = emptyMap()
)

object SampleData {
    val classes = listOf(
        ClassItem(
            id = "faaa9241-3458-436a-95a4-4203256f6931",
            name = "Kelas 1",
            studentCount = 2,
            students = listOf(
                StudentItem("de0b25f8-600f-4af4-9449-7796348f5a65", "Gibran", "Aktif", picturePassword = listOf(1, 5, 3), isLocked = false),
                StudentItem("3218fcaa-cd88-4aba-91da-37fd561c02d2", "Raka", "Aktif", picturePassword = listOf(2, 5, 8), isLocked = false)
            )
        )
    )

    val tasks: SnapshotStateList<TaskItem> = mutableStateListOf()
}
