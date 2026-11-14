package com.lomba.satu

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.ClassItem
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.StudentItem
import com.lomba.satu.ui.components.AppBottomNavigationBar
import com.lomba.satu.ui.components.BottomTab
import com.lomba.satu.ui.screens.*
import com.lomba.satu.ui.theme.SatuTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            var currentRole by remember { mutableStateOf(AppRole.GURU) }
            var isLoggedIn by remember { mutableStateOf(false) }

            SatuTheme(role = currentRole) {
                MainAppContent(
                    isLoggedIn = isLoggedIn,
                    currentRole = currentRole,
                    onRoleToggle = { newRole -> currentRole = newRole },
                    onLoginSuccess = { isLoggedIn = true },
                    onLogout = { isLoggedIn = false }
                )
            }
        }
    }
}

private fun getNavDepth(navKey: String): Int {
    return when {
        navKey.contains("REPORT") || navKey.contains("BUAT_PIN") || navKey.contains("PROFILE_LOCKED") || navKey == "PARENT_PRACTICE" -> 3
        navKey.contains("STUDENT_") || navKey.contains("KENDALI_MANUAL") || navKey == "TAMBAH_TUGAS" || navKey == "ADD_CHILD" || navKey == "PARENT_TASK_WORDS" -> 2
        navKey.contains("CLASS_") -> 1
        navKey == "INVITE_LINK" -> 3
        else -> 0
    }
}

@Composable
fun MainAppContent(
    isLoggedIn: Boolean,
    currentRole: AppRole,
    onRoleToggle: (AppRole) -> Unit,
    onLoginSuccess: () -> Unit,
    onLogout: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        if (SampleData.tasks.isEmpty()) {
            val savedTasks = com.lomba.satu.data.TaskStorage.loadTasks(context)
            if (savedTasks.isNotEmpty()) {
                SampleData.tasks.addAll(savedTasks)
            }
        }
    }
    var currentTab by remember { mutableStateOf(BottomTab.PETA) }
    var selectedClass by remember { mutableStateOf<ClassItem?>(null) }
    var selectedStudent by remember { mutableStateOf<StudentItem?>(null) }
    var inviteLink by remember { mutableStateOf<String?>(null) }
    var isAddingChildFlow by remember { mutableStateOf(false) }
    var pendingAddChildName by remember { mutableStateOf<String?>(null) }
    var pendingAddChildWa by remember { mutableStateOf<String?>(null) }
    var isAddingChildPinStep by remember { mutableStateOf(false) }

    // Sub-screen flags
    var isViewingReport by remember { mutableStateOf(false) }
    var isViewingKendaliManual by remember { mutableStateOf(false) }
    var isViewingBuatPin by remember { mutableStateOf(false) }
    var isViewingProfileTerkunci by remember { mutableStateOf(false) }
    var isAddingTask by remember { mutableStateOf(false) }
    var isParentTaskWordsView by remember { mutableStateOf(false) }
    var isParentPracticing by remember { mutableStateOf(false) }
    var parentWordsState by remember { mutableStateOf(listOf("f", "h", "m")) }
    var selectedPracticeWord by remember { mutableStateOf("f") }

    fun resetSubScreens() {
        selectedClass = null
        selectedStudent = null
        inviteLink = null
        isAddingChildFlow = false
        pendingAddChildName = null
        pendingAddChildWa = null
        isAddingChildPinStep = false
        isViewingReport = false
        isViewingKendaliManual = false
        isViewingBuatPin = false
        isViewingProfileTerkunci = false
        isAddingTask = false
        isParentTaskWordsView = false
        isParentPracticing = false
    }

    AnimatedContent(
        targetState = isLoggedIn,
        transitionSpec = {
            fadeIn(animationSpec = tween(300)) + scaleIn(animationSpec = tween(300), initialScale = 0.95f) togetherWith
                    fadeOut(animationSpec = tween(250))
        },
        label = "AuthTransition"
    ) { loggedIn ->
        if (!loggedIn) {
            LoginScreen(
                currentRole = currentRole,
                onRoleToggle = onRoleToggle,
                onLoginSuccess = onLoginSuccess,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Scaffold(
                bottomBar = {
                    AppBottomNavigationBar(
                        currentTab = currentTab,
                        onTabSelected = { tab ->
                            currentTab = tab
                            resetSubScreens()
                        },
                        role = currentRole
                    )
                }
            ) { innerPadding ->
                val navKey = if (currentRole == AppRole.GURU) {
                    when (currentTab) {
                        BottomTab.PETA -> "PETA_SUMMARY_MATRIX"
                        BottomTab.TUGAS -> when {
                            isAddingTask -> "TAMBAH_TUGAS"
                            else -> "TUGAS"
                        }
                        BottomTab.ANAK -> when {
                            isAddingChildFlow -> "ADD_CHILD"
                            isAddingChildPinStep -> "ADD_CHILD_PIN"
                            inviteLink != null -> "INVITE_LINK"
                            isViewingBuatPin -> "ANAK_BUAT_PIN"
                            isViewingProfileTerkunci -> "ANAK_PROFILE_LOCKED"
                            isViewingReport -> "ANAK_REPORT"
                            isViewingKendaliManual -> "ANAK_KENDALI_MANUAL"
                            selectedStudent != null -> "STUDENT_${selectedStudent?.id}"
                            selectedClass != null -> "CLASS_${selectedClass?.id}"
                            else -> "ANAK_HOME"
                        }
                        BottomTab.AKUN -> "AKUN"
                    }
                } else {
                    when (currentTab) {
                        BottomTab.PETA -> when {
                            isParentPracticing -> "PARENT_PRACTICE"
                            isParentTaskWordsView -> "PARENT_TASK_WORDS"
                            else -> "PARENT_HOME"
                        }
                        BottomTab.TUGAS -> if (isViewingReport) "PARENT_REPORT" else "PARENT_PROGRESS"
                        BottomTab.ANAK -> "PARENT_REPORT"
                        BottomTab.AKUN -> "PARENT_AKUN"
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    AnimatedContent(
                        targetState = navKey,
                        transitionSpec = {
                            val initialDepth = getNavDepth(initialState)
                            val targetDepth = getNavDepth(targetState)

                            when {
                                targetDepth > initialDepth -> {
                                    slideInHorizontally(animationSpec = tween(280)) { fullWidth -> fullWidth } + fadeIn(tween(280)) togetherWith
                                            slideOutHorizontally(animationSpec = tween(240)) { fullWidth -> -fullWidth / 3 } + fadeOut(tween(240))
                                }
                                targetDepth < initialDepth -> {
                                    slideInHorizontally(animationSpec = tween(280)) { fullWidth -> -fullWidth / 3 } + fadeIn(tween(280)) togetherWith
                                            slideOutHorizontally(animationSpec = tween(240)) { fullWidth -> fullWidth } + fadeOut(tween(240))
                                }
                                else -> {
                                    fadeIn(animationSpec = tween(220)) + scaleIn(animationSpec = tween(220), initialScale = 0.97f) togetherWith
                                            fadeOut(animationSpec = tween(180))
                                }
                            }
                        },
                        label = "ScreenTransition"
                    ) { _ ->
                        if (currentRole == AppRole.GURU) {
                            when (currentTab) {
                                BottomTab.PETA -> {
                                    PetaMatrixSummaryScreen(role = currentRole)
                                }

                                BottomTab.TUGAS -> {
                                    if (isAddingTask) {
                                        TambahTugasScreen(
                                            role = currentRole,
                                            onTaskAdded = { isAddingTask = false },
                                            onBack = { isAddingTask = false }
                                        )
                                    } else {
                                        TugasHarianScreen(
                                            role = currentRole,
                                            onTambahTugasClick = { isAddingTask = true }
                                        )
                                    }
                                }

                                BottomTab.ANAK -> {
                                    when {
                                        isAddingChildFlow -> {
                                            TambahAnakScreen(
                                                role = currentRole,
                                                onNextStep = { name, wa ->
                                                    pendingAddChildName = name
                                                    pendingAddChildWa = wa
                                                    isAddingChildPinStep = true
                                                    isAddingChildFlow = false
                                                },
                                                onBackClick = { isAddingChildFlow = false }
                                            )
                                        }
                                        isAddingChildPinStep -> {
                                            BuatPinScreen(
                                                role = currentRole,
                                                title = "Buat Pin",
                                                onPinSaved = { selectedPin ->
                                                    val cName = pendingAddChildName ?: "Anak Baru"
                                                    val cWa = pendingAddChildWa
                                                    coroutineScope.launch {
                                                        try {
                                                            if (ApiService.teacherToken != null) {
                                                                val res = ApiService.createStudent(
                                                                    nickname = cName,
                                                                    picturePassword = selectedPin,
                                                                    parentWhatsapp = cWa
                                                                )
                                                                val inv = res.optJSONObject("invite")
                                                                val url = inv?.optString("inviteUrl") ?: "https://tunarungu.neotelemetri.id/undangan/0_bBi9PksspIQtnVHE93AX3da7QVzdKL"
                                                                inviteLink = url
                                                            } else {
                                                                inviteLink = "https://tunarungu.neotelemetri.id/undangan/0_bBi9PksspIQtnVHE93AX3da7QVzdKL"
                                                            }
                                                        } catch (_: Exception) {
                                                            inviteLink = "https://tunarungu.neotelemetri.id/undangan/0_bBi9PksspIQtnVHE93AX3da7QVzdKL"
                                                        } finally {
                                                            isAddingChildPinStep = false
                                                        }
                                                    }
                                                },
                                                onBack = { isAddingChildPinStep = false }
                                            )
                                        }
                                        inviteLink != null -> {
                                            AnakDitambahkanScreen(
                                                inviteLink = inviteLink!!,
                                                role = currentRole,
                                                onDone = {
                                                    inviteLink = null
                                                    pendingAddChildName = null
                                                    pendingAddChildWa = null
                                                }
                                            )
                                        }
                                        isViewingBuatPin -> {
                                            BuatPinScreen(
                                                role = currentRole,
                                                onPinSaved = { newPin ->
                                                    selectedStudent?.let { st ->
                                                        val updatedSt = st.copy(picturePassword = newPin)
                                                        selectedStudent = updatedSt
                                                        coroutineScope.launch {
                                                            try {
                                                                if (ApiService.teacherToken != null) {
                                                                    ApiService.resetStudentPin(st.id, newPin)
                                                                }
                                                            } catch (_: Exception) {}
                                                        }
                                                    }
                                                    isViewingBuatPin = false
                                                },
                                                onBack = { isViewingBuatPin = false }
                                            )
                                        }
                                        isViewingProfileTerkunci -> {
                                            ProfileTerkunciScreen(
                                                role = currentRole,
                                                onBack = { isViewingProfileTerkunci = false }
                                            )
                                        }
                                        isViewingReport -> {
                                            ReportStudentScreen(
                                                student = selectedStudent ?: SampleData.classes.first().students.first(),
                                                role = currentRole,
                                                onBack = { isViewingReport = false }
                                            )
                                        }
                                        isViewingKendaliManual -> {
                                            KendaliManualScreen(
                                                role = currentRole,
                                                onResetPinClick = { isViewingBuatPin = true },
                                                onBack = { isViewingKendaliManual = false }
                                            )
                                        }
                                        selectedStudent != null -> {
                                            StudentDetailScreen(
                                                student = selectedStudent!!,
                                                role = currentRole,
                                                onReportClick = { isViewingReport = true },
                                                onKendaliManualClick = { isViewingKendaliManual = true },
                                                onBack = { selectedStudent = null }
                                            )
                                        }
                                        selectedClass != null -> {
                                            KelasDetailScreen(
                                                classItem = selectedClass!!,
                                                role = currentRole,
                                                onStudentSelected = { student -> selectedStudent = student },
                                                onAddStudentClick = { isAddingChildFlow = true },
                                                onProfileTerkunciClick = { isViewingProfileTerkunci = true },
                                                onBack = { selectedClass = null }
                                            )
                                        }
                                        else -> {
                                            KelasSayaScreen(
                                                role = currentRole,
                                                onClassSelected = { classItem -> selectedClass = classItem }
                                            )
                                        }
                                    }
                                }

                                BottomTab.AKUN -> {
                                    AkunScreen(
                                        currentRole = currentRole,
                                        onRoleToggle = onRoleToggle,
                                        onLogout = onLogout
                                    )
                                }
                            }
                        } else {
                            // Wali Murid Screens (Parent Mode)
                            when (currentTab) {
                                BottomTab.PETA -> { // "Beranda"
                                    when {
                                        isParentPracticing -> {
                                            ParentPracticeScreen(
                                                word = selectedPracticeWord,
                                                tutorialUrl = "https://tunarungu.neotelemetri.id/tutorial/t1-$selectedPracticeWord.mp4",
                                                onBack = { isParentPracticing = false }
                                            )
                                        }
                                        isParentTaskWordsView -> {
                                            ParentTaskWordsScreen(
                                                words = parentWordsState,
                                                onWordSelected = { word ->
                                                    selectedPracticeWord = word
                                                    isParentPracticing = true
                                                },
                                                onBack = { isParentTaskWordsView = false }
                                            )
                                        }
                                        else -> {
                                            ParentHomeScreen(
                                                onTaskClick = { taskWords ->
                                                    if (taskWords.isNotEmpty()) parentWordsState = taskWords
                                                    isParentTaskWordsView = true
                                                },
                                                onStartPracticeClick = { taskWords ->
                                                    if (taskWords.isNotEmpty()) {
                                                        parentWordsState = taskWords
                                                        selectedPracticeWord = taskWords.first()
                                                        isParentPracticing = true
                                                    } else {
                                                        isParentTaskWordsView = true
                                                    }
                                                },
                                                onViewProgressClick = { currentTab = BottomTab.TUGAS }
                                            )
                                        }
                                    }
                                }
                                BottomTab.TUGAS -> { // "Progress"
                                    if (isViewingReport) {
                                        ParentReportScreen(onBack = { isViewingReport = false })
                                    } else {
                                        ParentProgressScreen(onViewReportClick = { isViewingReport = true })
                                    }
                                }
                                BottomTab.ANAK -> { // "Laporan"
                                    ParentReportScreen(onBack = {})
                                }
                                BottomTab.AKUN -> { // "Akun"
                                    ParentAkunScreen(onLogout = onLogout)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun LoginPreview() {
    SatuTheme(role = AppRole.GURU) {
        LoginScreen(
            currentRole = AppRole.GURU,
            onRoleToggle = {},
            onLoginSuccess = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun KelasSayaPreview() {
    SatuTheme(role = AppRole.GURU) {
        KelasSayaScreen(
            role = AppRole.GURU,
            onClassSelected = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun KelasDetailPreview() {
    SatuTheme(role = AppRole.GURU) {
        KelasDetailScreen(
            classItem = SampleData.classes.first(),
            role = AppRole.GURU,
            onStudentSelected = {},
            onAddStudentClick = {},
            onProfileTerkunciClick = {},
            onBack = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun TugasHarianPreview() {
    SatuTheme(role = AppRole.GURU) {
        TugasHarianScreen(
            role = AppRole.GURU,
            onTambahTugasClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun TambahAnakPreview() {
    SatuTheme(role = AppRole.GURU) {
        TambahAnakScreen(
            role = AppRole.GURU,
            onNextStep = { _, _ -> }
        )
    }
}

@Preview(showBackground = true)
@Composable
fun AkunPreview() {
    SatuTheme(role = AppRole.GURU) {
        AkunScreen(
            currentRole = AppRole.GURU,
            onRoleToggle = {},
            onLogout = {}
        )
    }
}
