package com.lomba.satu.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class ApiError(val status: Int, message: String) : Exception(message)

data class InfoUndangan(val namaOrangTua: String, val anak: List<String>)
data class SesiOrangTua(val token: String, val id: String, val nama: String, val email: String)

object ApiService {
    private const val BASE_URL = "https://tunarungu.neotelemetri.id/api"
    var teacherToken: String? = null
    var teacherName: String = "Bu Guru"
    var teacherEmail: String = "guru@sekolah.id"
    var currentClassroomId: String? = null
    var currentClassroomName: String = "Kelas 1"

    var parentToken: String? = null
    var parentName: String = "Orang tua Anak"
    var parentEmail: String = "java@gmail.com"
    var parentChildId: String = ""
    var parentChildName: String = "Anak"
    var studentToken: String? = null

    fun ambilToken(linkAtauToken: String): String =
        linkAtauToken.trim().trimEnd('/').substringAfterLast('/').substringBefore('?')

    private suspend fun makeRequest(
        endpoint: String,
        method: String = "GET",
        jsonBody: JSONObject? = null,
        jsonArrayBody: JSONArray? = null,
        tokenToUse: String? = teacherToken ?: parentToken
    ): String = withContext(Dispatchers.IO) {
        val url = URL("$BASE_URL$endpoint")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")

            tokenToUse?.let { token ->
                conn.setRequestProperty("Authorization", "Bearer $token")
            }

            conn.connectTimeout = 15000
            conn.readTimeout = 20000

            if ((method == "POST" || method == "PUT") && (jsonBody != null || jsonArrayBody != null)) {
                conn.doOutput = true
                val bodyString = jsonBody?.toString() ?: jsonArrayBody?.toString() ?: ""
                OutputStreamWriter(conn.outputStream, "UTF-8").use { writer ->
                    writer.write(bodyString)
                    writer.flush()
                }
            }

            val statusCode = conn.responseCode
            val inputStream = if (statusCode in 200..299) conn.inputStream else conn.errorStream
            val responseString = BufferedReader(InputStreamReader(inputStream, "UTF-8")).use { reader ->
                reader.readText()
            }

            if (statusCode !in 200..299) {
                val detail = try {
                    JSONObject(responseString).optString("detail", "Error $statusCode")
                } catch (_: Exception) {
                    "Error $statusCode"
                }
                throw ApiError(statusCode, detail)
            }

            responseString
        } catch (e: ApiError) {
            throw e
        } catch (_: Exception) {
            throw ApiError(0, "Tidak bisa terhubung ke server. Periksa internet.")
        } finally {
            conn.disconnect()
        }
    }

    // Invite Endpoints
    suspend fun fetchInfoUndangan(inviteToken: String): InfoUndangan {
        val token = ambilToken(inviteToken)
        val response = makeRequest("/invites/$token", "GET")
        val j = JSONObject(response)
        val anakArr = j.optJSONArray("children") ?: JSONArray()
        val anakList = mutableListOf<String>()
        for (i in 0 until anakArr.length()) {
            anakList.add(anakArr.getString(i))
        }
        val childName = if (anakList.isNotEmpty()) anakList.first() else "Raka"
        parentChildName = childName
        parentName = j.optString("parentName", "Orang tua $childName")
        return InfoUndangan(
            namaOrangTua = parentName,
            anak = if (anakList.isNotEmpty()) anakList else listOf(childName)
        )
    }

    suspend fun acceptUndangan(inviteToken: String, email: String, sandi: String): SesiOrangTua {
        val token = ambilToken(inviteToken)
        val body = JSONObject().apply {
            put("email", email)
            put("password", sandi)
        }
        val response = makeRequest("/invites/$token/accept", "POST", body)
        val j = JSONObject(response)
        val p = j.getJSONObject("parent")
        val sesi = SesiOrangTua(
            token = j.getString("token"),
            id = p.getString("id"),
            nama = p.getString("name"),
            email = p.getString("email")
        )
        parentToken = sesi.token
        parentName = sesi.nama
        parentEmail = sesi.email

        // Update child name from parent session
        try {
            val childrenResp = makeRequest("/parent/children", "GET")
            val childrenArr = JSONArray(childrenResp)
            if (childrenArr.length() > 0) {
                val firstChild = childrenArr.getJSONObject(0)
                parentChildId = firstChild.optString("id", "")
                parentChildName = firstChild.optString("nickname", "Anak")
            }
        } catch (_: Exception) {}

        return sesi
    }

    // 1. Teacher Login
    suspend fun loginTeacher(email: String, password: String): JSONObject {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        val response = makeRequest("/auth/teacher/login", "POST", body)
        val json = JSONObject(response)
        teacherToken = json.optString("token")

        val teacherObj = json.optJSONObject("teacher")
        if (teacherObj != null) {
            teacherName = teacherObj.optString("name", "Bu Guru")
            teacherEmail = teacherObj.optString("email", email)
        }

        val classroomObj = json.optJSONObject("classroom")
        if (classroomObj != null) {
            currentClassroomId = classroomObj.optString("id")
            currentClassroomName = classroomObj.optString("name", "Kelas 1")
        }

        return json
    }

    // 1b. Parent Login
    suspend fun loginParent(email: String, password: String): JSONObject {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        val response = makeRequest("/auth/parent/login", "POST", body)
        val json = JSONObject(response)
        parentToken = json.optString("token")

        val parentObj = json.optJSONObject("parent")
        if (parentObj != null) {
            parentName = parentObj.optString("name", "Orang tua")
            parentEmail = parentObj.optString("email", email)
        }

        // Fetch children
        try {
            val childrenResp = makeRequest("/parent/children", "GET")
            val childrenArr = JSONArray(childrenResp)
            if (childrenArr.length() > 0) {
                val firstChild = childrenArr.getJSONObject(0)
                parentChildId = firstChild.optString("id", "")
                parentChildName = firstChild.optString("nickname", "Anak")
            }
        } catch (_: Exception) {}

        return json
    }

    // 2. Classrooms List & Create
    suspend fun fetchClassroomsList(): List<ClassItem> {
        val response = makeRequest("/classrooms", "GET")
        val jsonArr = JSONArray(response)
        val result = mutableListOf<ClassItem>()
        for (i in 0 until jsonArr.length()) {
            val obj = jsonArr.getJSONObject(i)
            val cId = obj.optString("id")
            val cName = obj.optString("name")
            val count = obj.optInt("studentCount", 0)
            result.add(ClassItem(id = cId, name = cName, studentCount = count))
        }
        return if (result.isNotEmpty()) result else SampleData.classes
    }

    suspend fun createClassroom(name: String): ClassItem {
        val body = JSONObject().apply { put("name", name) }
        val response = makeRequest("/classrooms", "POST", body)
        val obj = JSONObject(response)
        return ClassItem(
            id = obj.optString("id"),
            name = obj.optString("name"),
            studentCount = obj.optInt("studentCount", 0)
        )
    }

    // 3. Create Student
    suspend fun createStudent(
        nickname: String,
        picturePassword: List<Int>,
        classroomId: String? = null,
        parentName: String? = null,
        parentWhatsapp: String? = null
    ): JSONObject {
        val body = JSONObject().apply {
            put("nickname", nickname)
            put("picturePassword", JSONArray(picturePassword))
            if (!classroomId.isNullOrBlank()) put("classroomId", classroomId)
            if (!parentName.isNullOrBlank()) put("parentName", parentName)
            if (!parentWhatsapp.isNullOrBlank()) put("parentWhatsapp", parentWhatsapp)
        }
        val response = makeRequest("/students", "POST", body)
        return JSONObject(response)
    }

    // 4. Update Student PIN
    suspend fun resetStudentPin(studentId: String, picturePassword: List<Int>): JSONObject {
        val body = JSONObject().apply {
            put("picturePassword", JSONArray(picturePassword))
        }
        val response = makeRequest("/students/$studentId/picture-password", "PUT", body)
        return JSONObject(response)
    }

    // 5. Unlock Student Profile
    suspend fun unlockStudent(studentId: String): JSONObject {
        val response = makeRequest("/students/$studentId/unlock", "POST")
        return JSONObject(response)
    }

    // 6. Get Class Students Overview
    suspend fun fetchClassStudents(classroomId: String? = null): List<StudentItem> {
        val cId = classroomId ?: currentClassroomId
        val endpoint = if (cId.isNullOrEmpty()) "/classroom/students" else "/classroom/students?classroomId=$cId"
        val response = makeRequest(endpoint, "GET")
        val jsonArr = JSONArray(response)
        val list = mutableListOf<StudentItem>()
        for (i in 0 until jsonArr.length()) {
            val obj = jsonArr.getJSONObject(i)
            val stId = obj.optString("id")
            val nickname = obj.optString("nickname")
            val isLocked = obj.optBoolean("isLocked", false)
            val pinArr = obj.optJSONArray("picturePassword")
            val pinList = mutableListOf<Int>()
            if (pinArr != null && pinArr.length() > 0) {
                for (p in 0 until pinArr.length()) {
                    pinList.add(pinArr.getInt(p))
                }
            } else {
                pinList.addAll(if (nickname.equals("Gibran", ignoreCase = true)) listOf(1, 5, 3) else listOf(2, 5, 8))
            }

            list.add(
                StudentItem(
                    id = stId,
                    name = nickname,
                    picturePassword = pinList,
                    isLocked = isLocked
                )
            )
        }
        return if (list.isNotEmpty()) list else SampleData.classes.first().students
    }

    // 7. Get Class Sounds Matrix Overview for Peta Tab with bestStars
    suspend fun fetchClassSoundsMatrix(classroomId: String? = null): Triple<String, List<String>, List<StudentItem>> {
        val cId = classroomId ?: currentClassroomId
        val endpoint = if (cId.isNullOrEmpty()) "/dashboard/class/sounds" else "/dashboard/class/sounds?classroomId=$cId"
        val response = makeRequest(endpoint, "GET")
        val json = JSONObject(response)

        val classroomObj = json.optJSONObject("classroom")
        val cName = classroomObj?.optString("name") ?: "Kelas 1"

        val soundsArr = json.optJSONArray("sounds") ?: JSONArray()
        val soundsList = mutableListOf<String>()
        for (i in 0 until soundsArr.length()) {
            soundsList.add(soundsArr.getString(i))
        }
        val defaultSounds = if (soundsList.isNotEmpty()) soundsList else listOf("a", "i", "u", "e", "o", "F", "H", "M")

        val studentsArr = json.optJSONArray("students") ?: JSONArray()
        val studentList = mutableListOf<StudentItem>()

        for (i in 0 until studentsArr.length()) {
            val stObj = studentsArr.getJSONObject(i)
            val id = stObj.optString("id")
            val nickname = stObj.optString("nickname")
            val statusObj = stObj.optJSONObject("status")
            val clearedObj = stObj.optJSONObject("cleared")

            // Fetch bestStars from student detail for exact exercise completion
            val bestStarsMap = mutableMapOf<String, Int>()
            try {
                val stDetailStr = makeRequest("/dashboard/students/$id", "GET")
                val stDetailJson = JSONObject(stDetailStr)
                val levelsArr = stDetailJson.optJSONArray("levels") ?: JSONArray()
                for (l in 0 until levelsArr.length()) {
                    val lvlObj = levelsArr.getJSONObject(l)
                    val itemsArr = lvlObj.optJSONArray("items") ?: JSONArray()
                    for (m in 0 until itemsArr.length()) {
                        val itemObj = itemsArr.getJSONObject(m)
                        val itemId = itemObj.optString("id")
                        val stars = itemObj.optInt("bestStars", 0)
                        bestStarsMap[itemId] = stars
                    }
                }
            } catch (_: Exception) {}

            val progressMap = mutableMapOf<String, VowelStatus>()
            defaultSounds.forEach { sound ->
                val itemId1 = "t1-$sound"
                val itemId2 = "t2-$sound"
                val stars1 = bestStarsMap[itemId1] ?: 0
                val stars2 = bestStarsMap[itemId2] ?: 0
                val maxStars = maxOf(stars1, stars2)

                val isCleared = clearedObj?.optBoolean(sound, false) ?: false
                val sStr = statusObj?.optString(sound, "belum_dilatih") ?: "belum_dilatih"

                progressMap[sound] = when {
                    maxStars >= 1 || isCleared || sStr == "sudah_bisa" -> VowelStatus.MASTERED
                    sStr == "sedang_dilatih" -> VowelStatus.PRACTICING
                    else -> VowelStatus.NOT_STARTED
                }
            }

            studentList.add(
                StudentItem(
                    id = id,
                    name = nickname,
                    vowelsProgress = progressMap
                )
            )
        }

        return Triple(cName, defaultSounds, if (studentList.isNotEmpty()) studentList else SampleData.classes.first().students)
    }

    // 8. Get Single Student Dashboard Report
    suspend fun fetchStudentReport(studentId: String): StudentItem {
        val response = makeRequest("/dashboard/students/$studentId", "GET")
        val json = JSONObject(response)
        val stObj = json.optJSONObject("student")
        val name = stObj?.optString("nickname") ?: "Raka"
        val totalPoints = json.optInt("totalPoints", 180)
        val practiceDays7 = json.optInt("practiceDays7", 5)
        val streakObj = json.optJSONObject("streak")
        val streakVal = streakObj?.optInt("current", 4) ?: 4

        val pinArr = stObj?.optJSONArray("picturePassword") ?: json.optJSONArray("picturePassword")
        val pinList = mutableListOf<Int>()
        if (pinArr != null && pinArr.length() > 0) {
            for (p in 0 until pinArr.length()) {
                pinList.add(pinArr.getInt(p))
            }
        } else {
            pinList.addAll(if (name.equals("Gibran", ignoreCase = true)) listOf(1, 5, 3) else listOf(2, 5, 8))
        }

        val statusObj = json.optJSONObject("status")
        val clearedObj = json.optJSONObject("cleared")
        val progressMap = mutableMapOf<String, VowelStatus>()
        val defaultSounds = listOf("a", "i", "u", "e", "o", "F", "H", "M", "S", "T")

        defaultSounds.forEach { sound ->
            val sStr = statusObj?.optString(sound, "belum_dilatih") ?: "belum_dilatih"
            val isCleared = clearedObj?.optBoolean(sound, false) ?: false
            progressMap[sound] = when {
                isCleared || sStr == "sudah_bisa" -> VowelStatus.MASTERED
                sStr == "sedang_dilatih" -> VowelStatus.PRACTICING
                else -> VowelStatus.NOT_STARTED
            }
        }

        return StudentItem(
            id = studentId,
            name = name,
            picturePassword = pinList,
            totalPoints = totalPoints,
            practiceDays7 = practiceDays7,
            streakDays = streakVal,
            vowelsProgress = progressMap
        )
    }

    // 9. Get AI Suggested Homework Tasks for specific student or class
    suspend fun fetchAiSuggestedHomeworkForStudent(studentId: String?, studentName: String): List<String> {
        if (!studentId.isNullOrEmpty() && teacherToken != null) {
            try {
                val response = makeRequest("/ai/students/$studentId/suggested-homework", "GET")
                val json = JSONObject(response)
                val itemsArr = json.optJSONArray("items") ?: JSONArray()
                val list = mutableListOf<String>()
                for (i in 0 until itemsArr.length()) {
                    val itemObj = itemsArr.getJSONObject(i)
                    val txt = itemObj.optString("text", "")
                    if (txt.isNotBlank()) list.add(txt)
                }
                if (list.isNotEmpty()) return list
            } catch (_: Exception) {}
        }
        // Fallback recommendations tailored to student
        return when (studentName.lowercase()) {
            "raka" -> listOf("f", "h", "m")
            "sinta" -> listOf("s", "t", "m")
            "gibran" -> listOf("k", "l", "p")
            else -> listOf("f", "h", "m")
        }
    }

    fun mapSoundToLevelAndItem(sound: String): Pair<String, String> {
        val clean = sound.trim().lowercase()
        return when (clean) {
            "a", "i", "u" -> Pair("level-1", "t1-$clean")
            "e", "o" -> Pair("level-2", "t1-$clean")
            "f", "h", "m" -> Pair("level-3", "t1-$clean")
            "s", "t" -> Pair("level-4", "t1-$clean")
            "b", "p", "d", "k", "g", "l" -> Pair("level-5", "t1-$clean")
            else -> {
                if (clean.startsWith("t1-") || clean.startsWith("t2-")) {
                    val soundLetter = clean.removePrefix("t1-").removePrefix("t2-")
                    mapSoundToLevelAndItem(soundLetter)
                } else {
                    Pair("level-1", "t1-$clean")
                }
            }
        }
    }

    // 10. Post Homework Task
    suspend fun createHomework(studentId: String, studentName: String, items: List<String>, note: String = "Latihan Harian"): TaskItem {
        val itemsArray = JSONArray()
        val tutorialMap = mutableMapOf<String, String>()

        items.forEach { word ->
            val cleanWord = word.trim()
            val (lvlId, itmId) = mapSoundToLevelAndItem(cleanWord)
            val itemObj = JSONObject().apply {
                put("levelId", lvlId)
                put("item", itmId)
            }
            itemsArray.put(itemObj)
            tutorialMap[cleanWord] = "https://tunarungu.neotelemetri.id/tutorial/$itmId.mp4"
        }

        var validStudentId = studentId
        if (validStudentId.isBlank() || validStudentId.length < 10) {
            try {
                val stList = fetchClassStudents()
                val matched = stList.find { it.name.equals(studentName, ignoreCase = true) }
                if (matched != null) {
                    validStudentId = matched.id
                }
            } catch (_: Exception) {}
        }

        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())

        if (teacherToken != null && validStudentId.isNotBlank() && validStudentId.length > 10) {
            val body = JSONObject().apply {
                put("studentId", validStudentId)
                put("dueDate", todayStr)
                put("note", note)
                put("items", itemsArray)
            }
            val response = makeRequest("/homework", "POST", body)
            val json = JSONObject(response)
            val homeworkId = json.optString("id", System.currentTimeMillis().toString())
            val detailText = items.joinToString(" - ")
            return TaskItem(
                id = homeworkId,
                studentId = validStudentId,
                studentName = studentName,
                taskDetail = detailText,
                words = items,
                isCompleted = false,
                tutorialUrls = tutorialMap
            )
        }

        val detailText = items.joinToString(" - ")
        return TaskItem(
            id = System.currentTimeMillis().toString(),
            studentId = validStudentId,
            studentName = studentName,
            taskDetail = detailText,
            words = items,
            isCompleted = false,
            tutorialUrls = tutorialMap
        )
    }

    // 11. Fetch Homework Tasks for Class
    suspend fun fetchHomeworkTasks(classroomId: String? = null): List<TaskItem> {
        val cId = classroomId ?: currentClassroomId
        val endpoint = if (cId.isNullOrEmpty()) "/homework/submissions" else "/homework/submissions?classroomId=$cId"

        if (teacherToken != null) {
            try {
                val response = makeRequest(endpoint, "GET")
                val jsonArr = JSONArray(response)
                val list = mutableListOf<TaskItem>()
                for (i in 0 until jsonArr.length()) {
                    val obj = jsonArr.getJSONObject(i)
                    val hwId = obj.optString("id")
                    val stId = obj.optString("studentId")
                    val nickname = obj.optString("nickname", "Raka")
                    val statusStr = obj.optString("status", "assigned")
                    val itemsArr = obj.optJSONArray("items") ?: JSONArray()
                    val wordList = mutableListOf<String>()
                    val tutMap = mutableMapOf<String, String>()

                    for (j in 0 until itemsArr.length()) {
                        val itemObj = itemsArr.getJSONObject(j)
                        val itemText = itemObj.optString("itemText", itemObj.optString("item", ""))
                        val cleanText = itemText.removePrefix("t1-").removePrefix("t2-")
                        if (cleanText.isNotBlank()) {
                            wordList.add(cleanText)
                            val tUrl = itemObj.optString("tutorialUrl", "/tutorial/t1-$cleanText.mp4")
                            val fullUrl = if (tUrl.startsWith("http")) tUrl else "https://tunarungu.neotelemetri.id$tUrl"
                            tutMap[cleanText] = fullUrl
                        }
                    }
                    val detailText = wordList.joinToString(" - ")
                    list.add(
                        TaskItem(
                            id = hwId,
                            studentId = stId,
                            studentName = nickname,
                            taskDetail = detailText,
                            words = wordList,
                            isCompleted = statusStr == "done",
                            tutorialUrls = tutMap
                        )
                    )
                }
                return list
            } catch (_: Exception) {}
        }
        return emptyList()
    }

    // 12. Fetch Homework Tasks for Parent's Child
    suspend fun fetchParentHomeworkForChild(childId: String): List<TaskItem> {
        val targetChildId = if (childId.isNotBlank()) childId else parentChildId
        if (parentToken != null && targetChildId.isNotBlank()) {
            try {
                val response = makeRequest("/parent/children/$targetChildId/homework", "GET")
                val jsonArr = JSONArray(response)
                val list = mutableListOf<TaskItem>()
                for (i in 0 until jsonArr.length()) {
                    val obj = jsonArr.getJSONObject(i)
                    val hwId = obj.optString("id")
                    val stId = obj.optString("studentId", targetChildId)
                    val nickname = obj.optString("nickname", parentChildName)
                    val statusStr = obj.optString("status", "assigned")
                    val itemsArr = obj.optJSONArray("items") ?: JSONArray()
                    val wordList = mutableListOf<String>()
                    val tutMap = mutableMapOf<String, String>()

                    for (j in 0 until itemsArr.length()) {
                        val itemObj = itemsArr.getJSONObject(j)
                        val itemText = itemObj.optString("itemText", itemObj.optString("item", ""))
                        val cleanText = itemText.removePrefix("t1-").removePrefix("t2-")
                        if (cleanText.isNotBlank()) {
                            wordList.add(cleanText)
                            val tUrl = itemObj.optString("tutorialUrl", "/tutorial/t1-$cleanText.mp4")
                            val fullUrl = if (tUrl.startsWith("http")) tUrl else "https://tunarungu.neotelemetri.id$tUrl"
                            tutMap[cleanText] = fullUrl
                        }
                    }
                    val detailText = wordList.joinToString(" - ")
                    list.add(
                        TaskItem(
                            id = hwId,
                            studentId = stId,
                            studentName = nickname,
                            taskDetail = detailText,
                            words = wordList,
                            isCompleted = statusStr == "done",
                            tutorialUrls = tutMap
                        )
                    )
                }
                return list
            } catch (_: Exception) {}
        }
        return emptyList()
    }

    // 13. Fetch Parent Child Chart Rates for 7 days
    suspend fun fetchChildChartDays(childId: String): List<ChartDay> {
        val targetChildId = if (childId.isNotBlank()) childId else parentChildId
        val defaultDays = listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
        if (parentToken != null && targetChildId.isNotBlank()) {
            try {
                val response = makeRequest("/parent/children/$targetChildId/chart?days=7", "GET")
                val json = JSONObject(response)
                val dailyArr = json.optJSONArray("daily") ?: JSONArray()
                val list = mutableListOf<ChartDay>()

                for (i in 0 until dailyArr.length()) {
                    val obj = dailyArr.getJSONObject(i)
                    val dateStr = obj.optString("date", obj.optString("day", ""))
                    val rate = obj.optDouble("rate", 50.0).toFloat() / 100f
                    val label = if (dateStr.isNotBlank() && dateStr.length >= 10) {
                        val dayNum = dateStr.takeLast(2)
                        "H-$dayNum"
                    } else {
                        defaultDays.getOrElse(i) { "D${i + 1}" }
                    }
                    list.add(ChartDay(label, rate.coerceIn(0f, 1f)))
                }
                if (list.isNotEmpty()) return list
            } catch (_: Exception) {}
        }
        return listOf(
            ChartDay("Sen", 0.35f),
            ChartDay("Sel", 0.50f),
            ChartDay("Rab", 0.65f),
            ChartDay("Kam", 0.75f),
            ChartDay("Jum", 0.85f),
            ChartDay("Sab", 0.90f),
            ChartDay("Min", 0.95f)
        )
    }
data class AttemptResponse(
    val itemId: String,
    val stars: Int,
    val correct: Boolean,
    val accuracy: Int,
    val pointsEarned: Int,
    val totalPoints: Int,
    val homeworkDone: Boolean
)

    // 14. Post Practice Attempt
    suspend fun postAttempt(itemId: String, kemiripan: Double = 0.88, berhasil: Boolean = true): AttemptResponse {
        val cleanItem = itemId.removePrefix("t1-").removePrefix("t2-")
        val formattedItemId = "t1-$cleanItem"

        val body = JSONObject().apply {
            put("itemId", formattedItemId)
            put("berhasil", berhasil)
            put("langkah_tercapai", 1)
            put("durasi_ms", 2000)
            put("kemiripan", kemiripan)
        }

        if (studentToken != null || parentToken != null) {
            try {
                val response = makeRequest("/attempts", "POST", body)
                val json = JSONObject(response)
                val stars = json.optInt("stars", if (kemiripan >= 0.9) 3 else if (kemiripan >= 0.7) 2 else if (kemiripan >= 0.5) 1 else 0)
                val correct = json.optBoolean("correct", kemiripan >= 0.5)
                val accuracy = json.optInt("accuracy", (kemiripan * 100).toInt())
                val pointsEarned = json.optInt("pointsEarned", stars * 10)
                val totalPoints = json.optInt("totalPoints", 40)
                val hwDone = json.optBoolean("homeworkDone", false)

                return AttemptResponse(
                    itemId = formattedItemId,
                    stars = stars,
                    correct = correct,
                    accuracy = accuracy,
                    pointsEarned = pointsEarned,
                    totalPoints = totalPoints,
                    homeworkDone = hwDone
                )
            } catch (_: Exception) {}
        }

        val stars = if (kemiripan >= 0.9) 3 else if (kemiripan >= 0.7) 2 else if (kemiripan >= 0.5) 1 else 0
        val correct = kemiripan >= 0.5
        val accuracy = (kemiripan * 100).toInt()
        val pointsEarned = stars * 10

        return AttemptResponse(
            itemId = formattedItemId,
            stars = stars,
            correct = correct,
            accuracy = accuracy,
            pointsEarned = pointsEarned,
            totalPoints = 180,
            homeworkDone = false
        )
    }
}
