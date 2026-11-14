package com.lomba.satu.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object TaskStorage {
    private const val PREFS_NAME = "satu_tasks_prefs"
    private const val KEY_TASKS = "saved_tasks_json"

    fun saveTasks(context: Context, tasks: List<TaskItem>) {
        try {
            val array = JSONArray()
            tasks.forEach { t ->
                val obj = JSONObject().apply {
                    put("id", t.id)
                    put("studentId", t.studentId)
                    put("studentName", t.studentName)
                    put("taskDetail", t.taskDetail)
                    put("words", JSONArray(t.words))
                    put("isSent", t.isSent)
                    put("isCompleted", t.isCompleted)
                    val tutObj = JSONObject()
                    t.tutorialUrls.forEach { (k, v) -> tutObj.put(k, v) }
                    put("tutorialUrls", tutObj)
                }
                array.put(obj)
            }
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_TASKS, array.toString()).apply()
        } catch (_: Exception) {}
    }

    fun loadTasks(context: Context): List<TaskItem> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val jsonStr = prefs.getString(KEY_TASKS, null) ?: return emptyList()
        val list = mutableListOf<TaskItem>()
        try {
            val array = JSONArray(jsonStr)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("id")
                val stId = obj.optString("studentId")
                val stName = obj.optString("studentName")
                val detail = obj.optString("taskDetail")
                val isSent = obj.optBoolean("isSent", true)
                val isCompleted = obj.optBoolean("isCompleted", false)
                val wordsArr = obj.optJSONArray("words") ?: JSONArray()
                val wordsList = mutableListOf<String>()
                for (w in 0 until wordsArr.length()) {
                    wordsList.add(wordsArr.getString(w))
                }
                val tutObj = obj.optJSONObject("tutorialUrls")
                val tutMap = mutableMapOf<String, String>()
                tutObj?.keys()?.forEach { k -> tutMap[k] = tutObj.getString(k) }

                list.add(
                    TaskItem(
                        id = id,
                        studentId = stId,
                        studentName = stName,
                        taskDetail = detail,
                        words = wordsList,
                        isSent = isSent,
                        isCompleted = isCompleted,
                        tutorialUrls = tutMap
                    )
                )
            }
        } catch (_: Exception) {}
        return list
    }
}
