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

function formatTasksAsHTML(tasksByDays) {
    const history = Object.values(tasksByDays).map(date => {
        let dateHTML = `
        <div class="history-date-container">
            <h3 class="history-date" datetime=${date.taskDatetime}>${date.dateName}</h3>
            <time datetime=${formatDatetimeForHistory(date.dayTotalMs)}>${formatDurationForHistory(date.dayTotalMs)}</time>     
        </div>`
        
        const tasksList = date.tasks.map(task => {
            return `
            <li>
                <span>${task.name}</span>
                <div class="history-time-container">
                    <time datetime=${task.datetime}>${task.duration}</time>
                    <button id="task-delete" data-finished-at="${task.finishedAt}" aria-label="Delete task">X</button>
                </div>
            </li>`
        }).join('')
        const tasksHTML = `<ul class="history-task-list">${tasksList}</ul>`

        dateHTML += tasksHTML
        return dateHTML
    })

    return history.join('')
}

function showHistoryTasks() {
    if (historyTasks.length === 0) {
        historyContainer.innerHTML = `<p class="history-empty">Empty</p>`
        return
    }

    const tasksByDays = historyTasks.reduce((result, task) => {
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

    const historyHTML = formatTasksAsHTML(tasksByDays)

    historyContainer.innerHTML = historyHTML
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