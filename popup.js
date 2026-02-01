function setIcon(state) {
    let path

    switch (state) {
        case "running":
            path = {
                "16": "icons/timer-active-16.png",
                "32": "icons/timer-active-32.png"
            }
            break

        case "paused":
            path = {
                "16": "icons/timer-16.png",
                "32": "icons/timer-32.png"
            }
            break

        default:
            path = {
                "16": "icons/timer-idle-16.png",
                "32": "icons/timer-idle-32.png"
            }
    }

    ext.action.setIcon({ path })
}

function hideElement(element) {
    element.classList.add("hidden")
}

function showElement(element) {
    element.classList.remove("hidden")
}

function formatDateLong(date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date)
}

function formatDurationForHistory(totalMs) {
    const totalMinutes = Math.round(totalMs / 60000)

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours === 0) {
        return `${minutes}m`
    }

    return `${hours}h ${minutes}m`
}

function formatDatetimeForHistory(ms) {
    const totalSeconds = Math.round(ms / 1000)

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    let result = "PT"

    if (hours > 0) {
        result += `${hours}H`
    }

    if (minutes > 0 || hours === 0) {
        result += `${minutes}M`
    }

    return result
}

function disableTaskForm() {
    taskInput.disabled = true
    taskStart.disabled = true

    taskInputForm.classList.add("disabled")
}

function enableTaskForm() {
    taskInput.disabled = false
    taskStart.disabled = false

    taskInputForm.classList.remove("disabled")
}

async function startTask(event) {
    event.preventDefault()
    const taskName = taskInput.value

    if (taskName === "") {
        return
    }

    activeTask = {
        name: taskName,
        elapsedMs: 0,
        lastStart: Date.now(),
        isRunning: true
    }

    await ext.storage.local.set({ activeTask })
    taskInput.value = ""
    showActiveTask()
}

function getTotalElapsedMs(activeTask) {
    if (activeTask.isRunning) {
        return activeTask.elapsedMs + (Date.now() - activeTask.lastStart)    
    } else {
        return activeTask.elapsedMs
    }
}

function startTimer(activeTask) {
    stopTimer()
    intervalId = setInterval(() => updateTimer(activeTask), 250)
    setIcon("running")
}

function stopTimer() {
    clearInterval(intervalId)
    intervalId = null
}

async function pauseTimer() {
    stopTimer()

    const now = Date.now()
    const sessionMs = now - activeTask.lastStart

    activeTask.elapsedMs += sessionMs
    activeTask.lastStart = null
    activeTask.isRunning = false

    hideElement(pauseTaskButton)
    showElement(resumeTaskButton)
    showElement(saveTaskButton)
    showElement(discardTaskButton)

    setIcon("paused")

    await ext.storage.local.set({activeTask})
}

async function resumeTimer() {
    activeTask.lastStart = Date.now()
    activeTask.isRunning = true

    showElement(pauseTaskButton)
    hideElement(resumeTaskButton)
    hideElement(saveTaskButton)
    hideElement(discardTaskButton)

    await ext.storage.local.set({activeTask})
    startTimer(activeTask)
}

function updateTimer(activeTask) {
    const elapsedMs = getTotalElapsedMs(activeTask)

    const totalSeconds = Math.floor(elapsedMs / 1000)

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = hours.toString().padStart(2, "0")
    const mm = minutes.toString().padStart(2, "0")
    const ss = seconds.toString().padStart(2, "0")

    activeTaskTime.textContent = `${hh}:${mm}:${ss}` 
    activeTaskTime.setAttribute("datetime", `PT${hours}H${minutes}M${seconds}S`) 
}

async function saveTask() {
    const finishedTask = {
        name: activeTask.name,
        totalMs: activeTask.elapsedMs,
        finishedAt: new Date().toISOString()
    }

    historyTasks = [finishedTask, ...historyTasks]
    activeTask = null

    await ext.storage.local.set( { historyTasks })
    await ext.storage.local.remove("activeTask")

    hideElement(discardTaskButton)
    hideElement(saveTaskButton)
    hideElement(resumeTaskButton)
    showElement(pauseTaskButton)

    hideElement(activeTaskInfo)
    hideElement(activeTaskActions)
    showElement(activeTaskPlaceholder)

    enableTaskForm()
    showHistoryTasks()

    setIcon("idle")
}

async function discardTask() {
    activeTask = null
    await ext.storage.local.remove("activeTask")

    hideElement(discardTaskButton)
    hideElement(saveTaskButton)
    hideElement(resumeTaskButton)
    showElement(pauseTaskButton)

    hideElement(activeTaskInfo)
    hideElement(activeTaskActions)
    showElement(activeTaskPlaceholder)

    enableTaskForm()

    setIcon("idle")
}

async function deleteTask(event) {
    if (!event.target.matches("button[data-finished-at]")) return

    const finishedAt = event.target.dataset.finishedAt
    
    historyTasks = historyTasks.filter(task => task.finishedAt !== finishedAt)
    await ext.storage.local.set({ historyTasks })
    showHistoryTasks()
}

function showActiveTask() {
    if (activeTask) {
        disableTaskForm()

        showElement(activeTaskInfo)
        showElement(activeTaskActions)
        hideElement(activeTaskPlaceholder)

        activeTaskName.textContent = activeTask.name

        updateTimer(activeTask)

        if (activeTask.isRunning) {
            startTimer(activeTask)
        } else {
            hideElement(pauseTaskButton)
            showElement(resumeTaskButton)
            showElement(saveTaskButton)
            showElement(discardTaskButton)
        }
    } else {
        hideElement(activeTaskInfo)
        hideElement(activeTaskActions)
        showElement(activeTaskPlaceholder)
    }
}

function groupTasksByDay(tasks) {
    return tasks.reduce((result, task) => {
        const taskDate = new Date(task.finishedAt) 
        const taskMonth = (taskDate.getMonth() + 1).toString().padStart(2, "0")
        const taskDatetime = `${taskDate.getFullYear()}-${taskMonth}-${taskDate.getDate()}`

        const taskForHistory = {
            name: task.name,
            duration: formatDurationForHistory(task.totalMs),
            datetime: formatDatetimeForHistory(task.totalMs),
            finishedAt: task.finishedAt
        } 

        if (!result[taskDatetime]) {
            const dateName = formatDateLong(taskDate)        
            result[taskDatetime] = {
                dateName,
                taskDatetime,
                dayTotalMs: task.totalMs,
                tasks: [taskForHistory]
            }
        } else {
            result[taskDatetime].dayTotalMs += task.totalMs
            result[taskDatetime].tasks.push(taskForHistory)            
        }

        return result
    }, {})

}

function showHistoryTasks() {
    historyContainer.replaceChildren()

    if (historyTasks.length === 0) {
        const p = document.createElement("p")
        p.className = "history-empty"
        p.textContent = "Empty"
        historyContainer.appendChild(p)
        return
    }

    const tasksByDays = groupTasksByDay(historyTasks)
    
    for (const date of Object.values(tasksByDays)) {
        const dateContainer = document.createElement("div")
        dateContainer.className = "history-date-container"

        const h3 = document.createElement("h3")
        h3.textContent = date.dateName

        const totalTime = document.createElement("time")
        totalTime.textContent = formatDurationForHistory(date.dayTotalMs)
        totalTime.setAttribute("datetime", formatDatetimeForHistory(date.dayTotalMs))

        dateContainer.append(h3, totalTime)

        const ul = document.createElement("ul")
        ul.className = "history-task-list"

        console.log(date)
        for (const task of date.tasks) {
            const li = document.createElement("li")

            const name = document.createElement("span")
            name.textContent = task.name

            const timeContainer = document.createElement("div")
            timeContainer.className = "history-time-container"

            const time = document.createElement("time")
            time.textContent = task.duration
            time.setAttribute("datetime", task.datetime)

            const btn = document.createElement("button")
            btn.textContent = "X"
            btn.dataset.finishedAt = task.finishedAt
            btn.setAttribute("aria-label", "Delete task")

            timeContainer.append(time, btn)
            li.append(name, timeContainer)
            ul.appendChild(li)
        }

        historyContainer.append(dateContainer, ul)
    }
}

async function init() {
    const activeTaskResult = await ext.storage.local.get("activeTask")
    activeTask = activeTaskResult.activeTask || null

    const historyTasksResult = await ext.storage.local.get("historyTasks")
    historyTasks = historyTasksResult.historyTasks || []

    showActiveTask()
    showHistoryTasks()
}

const taskInputForm = document.getElementById("task-input-form")
const taskInput = document.getElementById("task-input")
const taskStart = document.getElementById("task-start")

const activeTaskInfo = document.getElementById("active-task-info")
const activeTaskActions = document.getElementById("active-task-actions")
const activeTaskPlaceholder = document.getElementById("active-task-placeholder")
const activeTaskName = document.getElementById("active-task-name")
const activeTaskTime = document.getElementById("active-task-time")

const pauseTaskButton = document.getElementById("task-pause")
const resumeTaskButton = document.getElementById("task-resume")
const saveTaskButton = document.getElementById("task-save")
const discardTaskButton = document.getElementById("task-discard")

const historyContainer = document.getElementById("history-container")

const ext = window.browser ?? window.chrome

let intervalId = null
let activeTask = null
let historyTasks = []

taskInputForm.addEventListener("submit", startTask)
pauseTaskButton.addEventListener("click", pauseTimer)
resumeTaskButton.addEventListener("click", resumeTimer)
discardTaskButton.addEventListener("click", discardTask)
saveTaskButton.addEventListener("click", saveTask)

historyContainer.addEventListener("click", deleteTask)

init()