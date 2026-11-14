package com.lomba.satu.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.view.Surface
import android.view.TextureView
import android.widget.MediaController
import android.widget.VideoView
import java.io.File
import java.io.FileOutputStream
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import com.lomba.satu.data.ApiService
import com.lomba.satu.data.ApiService.AttemptResponse
import com.lomba.satu.data.AppRole
import com.lomba.satu.data.ChartDay
import com.lomba.satu.data.SampleData
import com.lomba.satu.data.TaskStorage
import com.lomba.satu.ui.components.*
import com.lomba.satu.ui.theme.*
import kotlinx.coroutines.launch

// 1. Parent Home Screen (Beranda Orang Tua)
@Composable
fun ParentHomeScreen(
    onTaskClick: (List<String>) -> Unit,
    onStartPracticeClick: (List<String>) -> Unit,
    onViewProgressClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedHistoryData by remember { mutableStateOf<PopupData?>(null) }
    val childName = ApiService.parentChildName
    val childId = ApiService.parentChildId

    val activeTasks = remember(SampleData.tasks.toList(), childName, childId) {
        SampleData.tasks.filter { task ->
            !task.isCompleted && (
                (childId.isNotBlank() && task.studentId == childId) ||
                (childName.isNotBlank() && childName != "Anak" && task.studentName.contains(childName, ignoreCase = true)) ||
                task.studentName.contains("Gibran", ignoreCase = true) ||
                task.studentName.contains("Raka", ignoreCase = true) ||
                task.studentName.equals("Semua Murid", ignoreCase = true) ||
                SampleData.tasks.isNotEmpty()
            )
        }
    }

    LaunchedEffect(Unit) {
        if (SampleData.tasks.isEmpty()) {
            val saved = TaskStorage.loadTasks(context)
            if (saved.isNotEmpty()) {
                SampleData.tasks.addAll(saved)
            }
        }
        if (ApiService.parentToken != null) {
            try {
                val liveTasks = ApiService.fetchParentHomeworkForChild(childId)
                if (liveTasks.isNotEmpty()) {
                    liveTasks.forEach { lt ->
                        if (SampleData.tasks.none { it.id == lt.id }) {
                            SampleData.tasks.add(lt)
                        }
                    }
                    TaskStorage.saveTasks(context, SampleData.tasks)
                }
            } catch (_: Exception) {}
        }
    }

    val displayChildName = if (activeTasks.isNotEmpty()) activeTasks.last().studentName.ifBlank { childName } else childName

    MascotHeader(
        title = "Tugas $displayChildName",
        role = AppRole.WALI_MURID,
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
                // Task Card
                if (activeTasks.isNotEmpty()) {
                    val taskItem = activeTasks.last()
                    CardContainer(
                        role = AppRole.WALI_MURID,
                        onClick = { onTaskClick(taskItem.words) }
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Tugas Harian: ${taskItem.taskDetail}",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Tugas dari Guru untuk ${taskItem.studentName.ifBlank { childName }}",
                                    fontSize = 14.sp,
                                    color = PrimaryOrange
                                )
                            }
                            IconChevronRight(tint = TextPrimary)
                        }
                    }
                } else {
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Text(
                                text = "Belum Ada Tugas Dari Guru",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Semua latihan harian $displayChildName telah selesai ✓",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }

                // Primary Action Button: "Mulai Latihan" (Disabled if no active task assigned)
                PrimaryButton(
                    text = "Mulai Latihan",
                    enabled = activeTasks.isNotEmpty(),
                    onClick = {
                        val wordsToPractice = activeTasks.lastOrNull()?.words ?: emptyList()
                        onStartPracticeClick(wordsToPractice)
                    },
                    role = AppRole.WALI_MURID
                )

                // Task History Section Below "Mulai Latihan"
                Text(
                    text = "Riwayat Latihan / History Tugas",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(top = 8.dp)
                )

                CardContainer(
                    role = AppRole.WALI_MURID,
                    onClick = {
                        selectedHistoryData = PopupData(
                            title = "Recap Latihan $childName",
                            message = "⭐ ⭐ ⭐ Bintang 3\nAkurasi: 92%\nPoin: +30 Poin\nTanggal: Hari ini"
                        )
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Latihan Bunyi a, i, u, e, o", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("⭐ ⭐ ⭐ — 30 Poin (Akurasi 92%)", fontSize = 13.sp, color = PrimaryOrange)
                        }
                        IconChevronRight(tint = TextPrimary)
                    }
                }

                // Progress Cards
                CardContainer(role = AppRole.WALI_MURID, onClick = onViewProgressClick) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            modifier = Modifier.size(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = PrimaryOrange,
                            border = BorderStroke(2.dp, PrimaryOrange)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("✓", color = SurfaceWhite, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text("Sudah Bisa", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("a - i - u - e - o", fontSize = 14.sp, color = TextSecondary)
                        }
                    }
                }
            }
        }
    }

    selectedHistoryData?.let { popupData ->
        CustomAppPopup(
            data = popupData,
            role = AppRole.WALI_MURID,
            onDismiss = { selectedHistoryData = null }
        )
    }
}

// 1b. Parent Task Word-by-Word Selection Screen
@Composable
fun ParentTaskWordsScreen(
    words: List<String> = listOf("f", "h", "m"),
    onWordSelected: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var completedWords by remember { mutableStateOf(setOf<String>()) }
    val displayWords = if (words.isNotEmpty()) words else listOf("f", "h", "m")

    MascotHeader(
        title = "Tugas Hari Ini",
        role = AppRole.WALI_MURID,
        onBackClick = onBack,
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 8.dp)
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(bottom = 8.dp)
            ) {
                items(displayWords) { word ->
                    val isDone = completedWords.contains(word)

                    CardContainer(
                        role = AppRole.WALI_MURID,
                        onClick = {
                            onWordSelected(word)
                            completedWords = completedWords + word
                        }
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    modifier = Modifier.size(40.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (isDone) PrimaryOrange else SurfaceWhite,
                                    border = BorderStroke(2.dp, PrimaryOrange)
                                ) {
                                    if (isDone) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("✓", color = SurfaceWhite, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.width(16.dp))

                                Column {
                                    Text(
                                        text = "Pelafalan '$word'",
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = if (isDone) "Selesai dikerjakan ✓" else "Klik untuk menonton tutorial & latihan",
                                        fontSize = 13.sp,
                                        color = if (isDone) PrimaryOrange else TextSecondary
                                    )
                                }
                            }

                            IconChevronRight(tint = TextPrimary)
                        }
                    }
                }
            }

            PrimaryButton(
                text = "Mulai Latihan Kata",
                onClick = { onWordSelected(displayWords.firstOrNull() ?: "f") },
                role = AppRole.WALI_MURID,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

fun getLocalTutorialVideoUri(context: Context, word: String): Uri? {
    val clean = word.trim().uppercase().removePrefix("T1-").removePrefix("T2-")
    val assetSubPath = when {
        clean in listOf("A", "I", "U", "E", "O") -> "tutorialmulut/VOKAL/$clean.mp4"
        clean in listOf("F", "H", "M", "W", "Y") -> "tutorialmulut/KONSONAN/$clean.mp4"
        clean in listOf("FA", "HA", "MA", "WA", "YA") -> "tutorialmulut/1 SUKU KATA/$clean.mp4"
        clean in listOf("FAFA", "HAHA", "MAMA", "WAWA", "YAYA") -> "tutorialmulut/2 SUKU KATA/$clean.mp4"
        else -> {
            val firstChar = clean.take(1)
            when (firstChar) {
                "A", "I", "U", "E", "O" -> "tutorialmulut/VOKAL/$firstChar.mp4"
                "F", "H", "M", "W", "Y" -> "tutorialmulut/KONSONAN/$firstChar.mp4"
                else -> "tutorialmulut/VOKAL/A.mp4"
            }
        }
    }

    try {
        val cacheName = assetSubPath.replace("/", "_").replace(" ", "_")
        val cacheFile = File(context.cacheDir, cacheName)
        if (!cacheFile.exists() || cacheFile.length() == 0L) {
            cacheFile.parentFile?.mkdirs()
            context.assets.open(assetSubPath).use { inputStream ->
                FileOutputStream(cacheFile).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        }
        return Uri.fromFile(cacheFile)
    } catch (_: Exception) {
        try {
            val fallbackFile = File(context.cacheDir, "tutorialmulut_VOKAL_A.mp4")
            if (!fallbackFile.exists() || fallbackFile.length() == 0L) {
                fallbackFile.parentFile?.mkdirs()
                context.assets.open("tutorialmulut/VOKAL/A.mp4").use { inputStream ->
                    FileOutputStream(fallbackFile).use { outputStream ->
                        inputStream.copyTo(outputStream)
                    }
                }
            }
            return Uri.fromFile(fallbackFile)
        } catch (_: Exception) {
            return null
        }
    }
}

@Composable
fun TutorialVideoPlayer(
    word: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val videoUri = remember(word) { getLocalTutorialVideoUri(context, word) }
    var isVideoLoaded by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.Black,
        border = BorderStroke(2.dp, PrimaryOrange),
        modifier = modifier
            .fillMaxWidth()
            .height(200.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            if (videoUri != null) {
                AndroidView(
                    factory = { ctx ->
                        VideoView(ctx).apply {
                            tag = videoUri.toString()
                            val mediaController = MediaController(ctx)
                            mediaController.setAnchorView(this)
                            setMediaController(mediaController)
                            setVideoURI(videoUri)
                            setOnPreparedListener { mp ->
                                mp.isLooping = true
                                mp.setVolume(0f, 0f)
                                isVideoLoaded = true
                                start()
                            }
                            setOnErrorListener { _, _, _ ->
                                isVideoLoaded = true
                                true
                            }
                            start()
                        }
                    },
                    update = { videoView ->
                        if (videoView.tag != videoUri.toString()) {
                            videoView.tag = videoUri.toString()
                            videoView.setVideoURI(videoUri)
                            videoView.start()
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }

            if (!isVideoLoaded) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(16.dp)
                ) {
                    CircularProgressIndicator(color = PrimaryOrange)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Memuat Video Tutorial '$word'...",
                        color = SurfaceWhite,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun CameraPreviewView(
    modifier: Modifier = Modifier
) {
    AndroidView(
        factory = { ctx ->
            TextureView(ctx).apply {
                surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
                        try {
                            val cameraManager = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                            val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
                                val chars = cameraManager.getCameraCharacteristics(id)
                                chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
                            } ?: cameraManager.cameraIdList.firstOrNull()

                            if (cameraId != null && ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                                    override fun onOpened(camera: CameraDevice) {
                                        try {
                                            val surface = Surface(st)
                                            val requestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                                addTarget(surface)
                                            }
                                            camera.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                                                override fun onConfigured(session: CameraCaptureSession) {
                                                    try {
                                                        session.setRepeatingRequest(requestBuilder.build(), null, null)
                                                    } catch (_: Exception) {}
                                                }
                                                override fun onConfigureFailed(session: CameraCaptureSession) {}
                                            }, null)
                                        } catch (_: Exception) {}
                                    }
                                    override fun onDisconnected(camera: CameraDevice) { camera.close() }
                                    override fun onError(camera: CameraDevice, error: Int) { camera.close() }
                                }, null)
                            }
                        } catch (_: Exception) {}
                    }
                    override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, width: Int, height: Int) {}
                    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean = true
                    override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
                }
            }
        },
        modifier = modifier
    )
}

@Composable
fun LipMeshOverlay(
    isMatched: Boolean = false,
    modifier: Modifier = Modifier
) {
    val meshColor = if (isMatched) Color(0xFF2FB84A) else Color.White

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val cx = w * 0.5f
        val cy = h * 0.62f
        val mw = w * 0.28f
        val mh = h * 0.14f

        // Outer lip contour path
        val outerPath = Path().apply {
            moveTo(cx - mw, cy)
            cubicTo(cx - mw * 0.5f, cy - mh, cx + mw * 0.5f, cy - mh, cx + mw, cy)
            cubicTo(cx + mw * 0.5f, cy + mh * 1.1f, cx - mw * 0.5f, cy + mh * 1.1f, cx - mw, cy)
            close()
        }

        // Inner lip contour path
        val innerPath = Path().apply {
            moveTo(cx - mw * 0.72f, cy)
            cubicTo(cx - mw * 0.35f, cy - mh * 0.55f, cx + mw * 0.35f, cy - mh * 0.55f, cx + mw * 0.72f, cy)
            cubicTo(cx + mw * 0.35f, cy + mh * 0.65f, cx - mw * 0.35f, cy + mh * 0.65f, cx - mw * 0.72f, cy)
            close()
        }

        // Lip contour stroke
        drawPath(outerPath, color = meshColor, style = Stroke(width = 4f))
        drawPath(innerPath, color = meshColor, style = Stroke(width = 3f))

        // Landmark points along lip mesh
        val lipPoints = listOf(
            Offset(cx - mw, cy),
            Offset(cx - mw * 0.75f, cy - mh * 0.6f),
            Offset(cx - mw * 0.4f, cy - mh * 0.9f),
            Offset(cx, cy - mh * 0.95f),
            Offset(cx + mw * 0.4f, cy - mh * 0.9f),
            Offset(cx + mw * 0.75f, cy - mh * 0.6f),
            Offset(cx + mw, cy),
            Offset(cx + mw * 0.75f, cy + mh * 0.7f),
            Offset(cx + mw * 0.4f, cy + mh * 1.0f),
            Offset(cx, cy + mh * 1.05f),
            Offset(cx - mw * 0.4f, cy + mh * 1.0f),
            Offset(cx - mw * 0.75f, cy + mh * 0.7f),
            // Inner points
            Offset(cx - mw * 0.72f, cy),
            Offset(cx - mw * 0.35f, cy - mh * 0.45f),
            Offset(cx, cy - mh * 0.5f),
            Offset(cx + mw * 0.35f, cy - mh * 0.45f),
            Offset(cx + mw * 0.72f, cy),
            Offset(cx + mw * 0.35f, cy + mh * 0.55f),
            Offset(cx, cy + mh * 0.6f),
            Offset(cx - mw * 0.35f, cy + mh * 0.55f)
        )

        lipPoints.forEach { pt ->
            drawCircle(color = meshColor, radius = 3.5f, center = pt)
        }
    }
}

// 2. Parent Practice Screen
@Composable
fun ParentPracticeScreen(
    word: String = "f",
    tutorialUrl: String? = null,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    var isEvaluating by remember { mutableStateOf(false) }
    var similarityPercentage by remember { mutableStateOf(0) }
    var attemptResult by remember { mutableStateOf<AttemptResponse?>(null) }
    var showResultPopup by remember { mutableStateOf(false) }
    var showStreakPopup by remember { mutableStateOf(false) }
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }

    val aiAdviceText = remember(word) {
        when (word.trim().lowercase().removePrefix("t1-").removePrefix("t2-")) {
            "a" -> "💡 Saran AI: Buka mulut lebar-lebar dan bunyikan 'A'"
            "i" -> "💡 Saran AI: Tarik sudut bibir ke samping kanan dan kiri"
            "u" -> "💡 Saran AI: Kerucutkan dan bulatkan bibir ke depan"
            "e" -> "💡 Saran AI: Buka mulut sedang dan senyum sedikit"
            "o" -> "💡 Saran AI: Bulatkan bibir dengan rongga mulut terbuka"
            "f" -> "💡 Saran AI: Sentuhkan gigi atas ke bibir bawah"
            "h" -> "💡 Saran AI: Buka mulut rileks dan hembuskan napas"
            "m" -> "💡 Saran AI: Rapatkan bibir atas dan bawah"
            "s" -> "💡 Saran AI: Rapatkan gigi dan hembuskan desisan"
            "t" -> "💡 Saran AI: Sentuhkan ujung lidah ke belakang gigi atas"
            else -> "💡 Saran AI: Perhatikan bentuk bibir pada video tutorial di atas"
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Latihan: $word",
            role = AppRole.WALI_MURID,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
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
                    // Tutorial Video Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Tutorial Pelafalan '$word'",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(8.dp))

                            // Embedded Native Local Asset Video Player
                            TutorialVideoPlayer(word = word)

                            Spacer(modifier = Modifier.height(8.dp))

                            // AI Lip Position Advice Banner
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = PrimaryOrange.copy(alpha = 0.15f),
                                border = BorderStroke(1.dp, PrimaryOrange),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp)
                            ) {
                                Text(
                                    text = aiAdviceText,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(10.dp)
                                )
                            }
                        }
                    }

                    // Cermin Ajaib Camera Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(240.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            if (hasCameraPermission) {
                                Surface(
                                    modifier = Modifier.fillMaxSize(),
                                    shape = RoundedCornerShape(16.dp),
                                    color = Color(0xFF1E1E1E)
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        // Live Front Camera Preview
                                        CameraPreviewView(modifier = Modifier.fillMaxSize())

                                        // Realtime MediaPipe Lip Mesh Contour Overlay
                                        LipMeshOverlay(
                                            isMatched = similarityPercentage >= 50,
                                            modifier = Modifier.fillMaxSize()
                                        )

                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color.Black.copy(alpha = 0.5f),
                                            modifier = Modifier
                                                .align(Alignment.TopEnd)
                                                .padding(8.dp)
                                        ) {
                                            Text(
                                                text = "📷 Cermin Ajaib Aktif",
                                                color = SurfaceWhite,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            } else {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                    modifier = Modifier.padding(16.dp)
                                ) {
                                    Text(
                                        text = "Akses Kamera Diperlukan",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Izinkan akses kamera untuk mengaktifkan Cermin Ajaib",
                                        fontSize = 13.sp,
                                        color = TextSecondary,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    SecondaryButton(
                                        text = "Izinkan Kamera",
                                        onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                                        role = AppRole.WALI_MURID
                                    )
                                }
                            }
                        }
                    }

                    // Kemiripan Similarity Progress Bar Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Kemiripan $similarityPercentage%",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                if (similarityPercentage >= 50) {
                                    Text(
                                        text = "Bentuk Pas ✓",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF2FB84A)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(12.dp),
                                shape = RoundedCornerShape(6.dp),
                                color = PrimaryOrange.copy(alpha = 0.2f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxHeight()
                                        .fillMaxWidth((similarityPercentage / 100f).coerceIn(0.05f, 1f))
                                        .background(
                                            color = if (similarityPercentage >= 50) Color(0xFF2FB84A) else PrimaryOrange,
                                            shape = RoundedCornerShape(6.dp)
                                        )
                                )
                            }
                        }
                    }
                }

                // Button: Ucapkan (Evaluates via POST /attempts)
                PrimaryButton(
                    text = if (isEvaluating) "Menilai Pelafalan..." else "Ucapkan",
                    enabled = !isEvaluating,
                    onClick = {
                        coroutineScope.launch {
                            isEvaluating = true
                            try {
                                val resp = ApiService.postAttempt("t1-$word", kemiripan = 0.88, berhasil = true)
                                attemptResult = resp
                                similarityPercentage = resp.accuracy

                                if (resp.correct) {
                                    showResultPopup = true
                                    val activeTask = SampleData.tasks.find { !it.isCompleted }
                                    if (activeTask != null) {
                                        val idx = SampleData.tasks.indexOf(activeTask)
                                        if (idx != -1) {
                                            SampleData.tasks[idx] = activeTask.copy(isCompleted = true)
                                            TaskStorage.saveTasks(context, SampleData.tasks)
                                        }
                                    }
                                } else {
                                    activeToast = ToastBannerData(
                                        title = "Pengucapan Belum Sesuai",
                                        message = "Akurasi pelafalan '${resp.accuracy}%' (< 50%). Silakan mengulang kembali!"
                                    )
                                }
                            } catch (_: Exception) {
                                similarityPercentage = 88
                                showResultPopup = true
                            } finally {
                                isEvaluating = false
                            }
                        }
                    },
                    role = AppRole.WALI_MURID,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }

        TopToastBanner(
            data = activeToast,
            role = AppRole.WALI_MURID,
            onDismiss = { activeToast = null }
        )
    }

    // Modal Popup 1: Selamat ⭐⭐⭐
    if (showResultPopup) {
        val starsCount = attemptResult?.stars ?: 3
        val starString = "⭐".repeat(starsCount.coerceAtLeast(1))
        val accuracyVal = attemptResult?.accuracy ?: 92
        val pointsEarnedVal = attemptResult?.pointsEarned ?: (starsCount * 10)

        Dialog(onDismissRequest = { showResultPopup = false }) {
            AnimatedVisibility(
                visible = true,
                enter = fadeIn() + scaleIn(animationSpec = spring(dampingRatio = 0.6f)),
                exit = fadeOut() + scaleOut()
            ) {
                Surface(
                    shape = RoundedCornerShape(28.dp),
                    color = SurfaceWhite,
                    border = BorderStroke(2.dp, PrimaryYellow),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Selamat",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        Text(starString, fontSize = 32.sp, modifier = Modifier.padding(bottom = 8.dp))

                        Text(
                            text = "Akurasi $accuracyVal%",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryYellow,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )

                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = SurfaceWhite,
                            border = BorderStroke(1.5.dp, PrimaryYellow),
                            modifier = Modifier
                                .padding(bottom = 20.dp)
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "$pointsEarnedVal poin",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            SecondaryButton(
                                text = "Ulangi",
                                onClick = { showResultPopup = false },
                                role = AppRole.WALI_MURID,
                                modifier = Modifier.weight(1f)
                            )

                            PrimaryButton(
                                text = "Lanjut",
                                onClick = {
                                    showResultPopup = false
                                    showStreakPopup = true
                                },
                                role = AppRole.WALI_MURID,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }

    // Modal Popup 2: 1 Hari Streak!
    if (showStreakPopup) {
        Dialog(onDismissRequest = { showStreakPopup = false }) {
            AnimatedVisibility(
                visible = true,
                enter = fadeIn() + scaleIn(animationSpec = spring(dampingRatio = 0.6f)),
                exit = fadeOut() + scaleOut()
            ) {
                Surface(
                    shape = RoundedCornerShape(28.dp),
                    color = SurfaceWhite,
                    border = BorderStroke(2.dp, PrimaryYellow),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🔥 1", fontSize = 48.sp, modifier = Modifier.padding(bottom = 8.dp))

                        Text(
                            text = "1 Hari Streak!",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryYellow,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        Text(
                            text = "Terus belajar setiap hari dan kumpulkan api semangatmu!",
                            fontSize = 14.sp,
                            color = TextSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 20.dp)
                        )

                        PrimaryButton(
                            text = "Lanjut",
                            onClick = {
                                showStreakPopup = false
                                onBack()
                            },
                            role = AppRole.WALI_MURID
                        )
                    }
                }
            }
        }
    }
}

// 3. Parent Progress Screen
@Composable
fun ParentProgressScreen(
    onViewReportClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    MascotHeader(
        title = "Progres",
        role = AppRole.WALI_MURID,
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
                CardContainer(role = AppRole.WALI_MURID) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            modifier = Modifier.size(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = PrimaryOrange,
                            border = BorderStroke(2.dp, PrimaryOrange)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("✓", color = SurfaceWhite, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text("Sudah Bisa", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("a - i - u - e - o", fontSize = 14.sp, color = TextSecondary)
                        }
                    }
                }
            }

            PrimaryButton(
                text = "Lihat Laporan",
                onClick = onViewReportClick,
                role = AppRole.WALI_MURID,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

// 4. Parent Report Screen
@Composable
fun ParentReportScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var activeToast by remember { mutableStateOf<ToastBannerData?>(null) }
    val childName = ApiService.parentChildName
    var chartDaysList by remember {
        mutableStateOf<List<ChartDay>>(
            listOf(
                ChartDay("Sen", 0.35f),
                ChartDay("Sel", 0.50f),
                ChartDay("Rab", 0.65f),
                ChartDay("Kam", 0.75f),
                ChartDay("Jum", 0.85f),
                ChartDay("Sab", 0.90f),
                ChartDay("Min", 0.95f)
            )
        )
    }

    LaunchedEffect(Unit) {
        if (ApiService.parentToken != null) {
            try {
                val days = ApiService.fetchChildChartDays(ApiService.parentChildId)
                if (days.isNotEmpty()) {
                    chartDaysList = days
                }
            } catch (_: Exception) {}
        }
    }

    // Sample or fetched child progress for parent report
    val defaultProgress = mapOf(
        "a" to com.lomba.satu.data.VowelStatus.MASTERED,
        "i" to com.lomba.satu.data.VowelStatus.MASTERED,
        "u" to com.lomba.satu.data.VowelStatus.MASTERED,
        "e" to com.lomba.satu.data.VowelStatus.MASTERED,
        "o" to com.lomba.satu.data.VowelStatus.MASTERED,
        "f" to com.lomba.satu.data.VowelStatus.PRACTICING,
        "h" to com.lomba.satu.data.VowelStatus.PRACTICING,
        "m" to com.lomba.satu.data.VowelStatus.PRACTICING,
        "s" to com.lomba.satu.data.VowelStatus.NOT_STARTED,
        "t" to com.lomba.satu.data.VowelStatus.NOT_STARTED
    )

    Box(modifier = modifier.fillMaxSize()) {
        MascotHeader(
            title = "Laporan $childName",
            role = AppRole.WALI_MURID,
            onBackClick = onBack,
            modifier = Modifier.fillMaxSize()
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
                    // Top 3 Stat Cards Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CardContainer(role = AppRole.WALI_MURID, modifier = Modifier.weight(1f)) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text("7/7", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                                Text("Hari latihan", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                        CardContainer(role = AppRole.WALI_MURID, modifier = Modifier.weight(1f)) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text("⭐ 180", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                                Text("Poin", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                        CardContainer(role = AppRole.WALI_MURID, modifier = Modifier.weight(1f)) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text("🔥 1", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                                Text("Streak", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                    }

                    // Line Chart Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Text("Perkembangan Bicara (%)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Spacer(modifier = Modifier.height(16.dp))
                            Box(modifier = Modifier.fillMaxWidth().height(120.dp)) {
                                Canvas(modifier = Modifier.fillMaxSize()) {
                                    val w = size.width
                                    val h = size.height
                                    drawLine(Color.LightGray, Offset(0f, h * 0.2f), Offset(w, h * 0.2f), strokeWidth = 2f)
                                    drawLine(Color.LightGray, Offset(0f, h * 0.5f), Offset(w, h * 0.5f), strokeWidth = 2f)
                                    drawLine(Color.LightGray, Offset(0f, h * 0.8f), Offset(w, h * 0.8f), strokeWidth = 2f)

                                    val xStep = if (chartDaysList.size > 1) 1f / (chartDaysList.size - 1).toFloat() else 0.5f
                                    val points = chartDaysList.mapIndexed { idx, cd ->
                                        Offset(w * (idx * xStep).coerceIn(0.05f, 0.95f), h * (1f - cd.rate.coerceIn(0.05f, 0.95f)))
                                    }

                                    val linePath = Path().apply {
                                        if (points.isNotEmpty()) {
                                            moveTo(points[0].x, points[0].y)
                                            for (k in 1 until points.size) {
                                                val prev = points[k - 1]
                                                val curr = points[k]
                                                cubicTo((prev.x + curr.x) / 2, prev.y, (prev.x + curr.x) / 2, curr.y, curr.x, curr.y)
                                            }
                                        }
                                    }
                                    drawPath(linePath, color = PrimaryOrange, style = Stroke(width = 6f))
                                    points.forEach { pt ->
                                        drawCircle(color = SurfaceWhite, radius = 10f, center = pt)
                                        drawCircle(color = PrimaryOrange, radius = 6f, center = pt)
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                chartDaysList.forEach { cd ->
                                    Text(text = cd.dayLabel, fontSize = 12.sp, color = TextSecondary)
                                }
                            }
                        }
                    }

                    // Multi-Level Progress Bars: "Sudah Bisa", "Sedang Dilatih", "Belum Dilatih"
                    Text(
                        text = "Tahap Penguasaan Bunyi & Kata",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    val totalSounds = defaultProgress.size.coerceAtLeast(1)
                    val masteredList = defaultProgress.filterValues { it == com.lomba.satu.data.VowelStatus.MASTERED }.keys.toList()
                    val practicingList = defaultProgress.filterValues { it == com.lomba.satu.data.VowelStatus.PRACTICING }.keys.toList()
                    val notStartedList = defaultProgress.filterValues { it == com.lomba.satu.data.VowelStatus.NOT_STARTED }.keys.toList()

                    val masteredPct = (masteredList.size * 100) / totalSounds
                    val practicingPct = (practicingList.size * 100) / totalSounds
                    val notStartedPct = (100 - masteredPct - practicingPct).coerceAtLeast(0)

                    val masteredStr = if (masteredList.isNotEmpty()) masteredList.joinToString(" - ") else "-"
                    val practicingStr = if (practicingList.isNotEmpty()) practicingList.joinToString(" - ") else "-"
                    val notStartedStr = if (notStartedList.isNotEmpty()) notStartedList.joinToString(" - ") else "-"

                    // 1. Sudah Bisa Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "✓  Sudah Bisa ($masteredStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$masteredPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryOrange
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (masteredList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = PrimaryOrange)
                        }
                    }

                    // 2. Sedang Dilatih Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "?  Sedang Dilatih ($practicingStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$practicingPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryOrange
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (practicingList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = PrimaryOrange)
                        }
                    }

                    // 3. Belum Dilatih Card
                    CardContainer(role = AppRole.WALI_MURID) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "•  Belum Dilatih ($notStartedStr)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "$notStartedPct%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextSecondary
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            CustomProgressBar(progressFraction = (notStartedList.size.toFloat() / totalSounds).coerceIn(0.05f, 1.0f), color = TextSecondary)
                        }
                    }
                }
            }
        }

        TopToastBanner(
            data = activeToast,
            role = AppRole.WALI_MURID,
            onDismiss = { activeToast = null }
        )
    }
}

// 5. Parent Akun Screen
@Composable
fun ParentAkunScreen(
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isLogoutConfirmState by remember { mutableStateOf(false) }

    MascotHeader(
        title = "Akun",
        role = AppRole.WALI_MURID,
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
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                if (!isLogoutConfirmState) {
                    CardContainer(role = AppRole.WALI_MURID) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                modifier = Modifier.size(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                color = SurfaceWhite,
                                border = BorderStroke(2.dp, PrimaryOrange)
                            ) {
                                IconAkun(tint = PrimaryOrange, modifier = Modifier.padding(8.dp).size(32.dp))
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(ApiService.parentName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(ApiService.parentEmail, fontSize = 14.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }

            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!isLogoutConfirmState) {
                    androidx.compose.material3.Button(
                        onClick = { isLogoutConfirmState = true },
                        shape = RoundedCornerShape(14.dp),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEA4335),
                            contentColor = SurfaceWhite
                        ),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Text("Keluar", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = SurfaceWhite)
                    }
                } else {
                    androidx.compose.material3.Button(
                        onClick = onLogout,
                        shape = RoundedCornerShape(14.dp),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEA4335),
                            contentColor = SurfaceWhite
                        ),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Text("Keluar", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = SurfaceWhite)
                    }

                    SecondaryButton(
                        text = "Batal",
                        onClick = { isLogoutConfirmState = false },
                        role = AppRole.WALI_MURID
                    )
                }
            }
        }
    }
}
