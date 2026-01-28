function hidePauseButton() {
    pauseTaskButton.style.display = "none"
}

function showPauseButton() {
    pauseTaskButton.style.display = ""
}

function hideResumeButton() {
    resumeTaskButton.style.display = "none"
}

function showResumeButton() {
    resumeTaskButton.style.display = ""
}

function hideSaveButton() {
    saveTaskButton.style.display = "none"
}

function showSaveButton() {
    saveTaskButton.style.display = ""
}

function hideDiscardButton() {
    discardTaskButton.style.display = "none"
}

function showDiscardButton() {
    discardTaskButton.style.display = ""
}

function hideActiveTaskInfo() {
    activeTaskInfo.style.display = "none"
}

function showActiveTaskInfo() {
    activeTaskInfo.style.display = ""
}

function hideActiveTaskActions() {
    activeTaskActions.style.display = "none"
}

function showActiveTaskActions() {
    activeTaskActions.style.display = ""
}

function hideTaskPlaceholder() {
    noActiveTask.style.display = "none"
}

function showTaskPlaceholder() {
    noActiveTask.style.display = ""
}

function hideHistoryPlaceholder() {
    historyEmpty.style.display = "none"
}

function showHistoryPlaceholder() {
    historyEmpty.style.display = ""
}

function formatDateLong(date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date)
}

function formatTaskDuration(totalMs) {
    const totalMinutes = Math.floor(totalMs / 60000)

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const hh = hours.toString().padStart(2, "0")
    const mm = minutes.toString().padStart(2, "0")

    return `${hh}:${mm}`
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
    await browser.storage.local.set({
        activeTask: {
            name: taskName,
            elapsedMs: 0,
            lastStart: Date.now(),
            isRunning: true
        }    
    })
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

    const tick = () => {
        updateTimer(activeTask)

        const now = Date.now()
        const delay = 1000 - (now % 1000)

        timeoutId = setTimeout(tick, delay)
    }
    
    tick()
}

function stopTimer() {
    clearTimeout(timeoutId)
    timeoutId = null
}

async function pauseTimer() {
    stopTimer()

    const { activeTask } = await browser.storage.local.get("activeTask")
    
    const now = Date.now()
    const sessionMs = now - activeTask.lastStart

    activeTask.elapsedMs += sessionMs
    activeTask.lastStart = null
    activeTask.isRunning = false

    hidePauseButton()
    showResumeButton()
    showSaveButton()
    showDiscardButton()

    await browser.storage.local.set({activeTask})
}

async function resumeTimer() {
    const { activeTask } = await browser.storage.local.get("activeTask")

    activeTask.lastStart = Date.now()
    activeTask.isRunning = true

    showPauseButton()
    hideResumeButton()
    hideSaveButton()
    hideDiscardButton()

    await browser.storage.local.set({activeTask})
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
    activeTaskTime.setAttribute("datetime", `PT${hh}H:${mm}M:${ss}S`) 
}

async function saveTask() {
    const { activeTask } = await browser.storage.local.get("activeTask")
    const { historyTasks = [] } = await browser.storage.local.get("historyTasks")

    const finishedTask = {
        name: activeTask.name,
        totalMs: activeTask.elapsedMs,
        finishedAt: new Date().toISOString()
    }

    await browser.storage.local.set( {historyTasks: [...historyTasks, finishedTask] })
    await browser.storage.local.remove("activeTask")

    hideDiscardButton()
    hideSaveButton()
    hideResumeButton()
    showPauseButton()

    hideActiveTaskInfo()
    hideActiveTaskActions()
    showTaskPlaceholder()

    enableTaskForm()
    showTasksHistory()
}

async function discardTask() {
    await browser.storage.local.remove("activeTask")

    hideDiscardButton()
    hideSaveButton()
    hideResumeButton()
    showPauseButton()

    hideActiveTaskInfo()
    hideActiveTaskActions()
    showTaskPlaceholder()

    enableTaskForm()
}

async function showActiveTask() {
    const { activeTask } = await browser.storage.local.get("activeTask")

    if (activeTask) {
        disableTaskForm()

        showActiveTaskInfo()
        showActiveTaskActions()
        hideTaskPlaceholder()

        activeTaskName.textContent = activeTask.name

        updateTimer(activeTask)

        if (activeTask.isRunning) {
            startTimer(activeTask)
        } else {
            hidePauseButton()
            showResumeButton()
            showSaveButton()
            showDiscardButton()
        }
    } else {
        activeTaskInfo.style.display = "none"
        activeTaskActions.style.display = "none"
        noActiveTask.style.display = ""
    }
}

function formatTasksAsHTML(tasksByDays) {
    const history = Object.values(tasksByDays).map(date => {
        let dateHTML = `<h3 class="history-date" datetime=${date.taskDatetime}>${date.dateName}</h3>`
        
        const tasksList = date.tasks.map(task => {
            return `<li><span>${task.name}</span><time datetime=${task.duration}>${task.duration}</time>`
        }).join('')
        const tasksHTML = `<ul class="history-task-list">${tasksList}</ul>`

        dateHTML += tasksHTML
        return dateHTML
    })

    return history.join('')
}

async function showTasksHistory() {
    const { historyTasks = [] } = await browser.storage.local.get("historyTasks")
    if (historyTasks.length === 0) {
        showHistoryPlaceholder()
        return
    }

    const tasksByDays = historyTasks.reduce((result, task) => {
        const taskDate = new Date(task.finishedAt) 
        const taskDatetime = `${taskDate.getFullYear()}-${taskDate.getMonth() + 1}-${taskDate.getDate()}`

        const taskForHistory = {
            name: task.name,
            duration: formatTaskDuration(task.totalMs)
        } 

        if (!result[taskDatetime]) {
            const dateName = formatDateLong(taskDate)        
            result[taskDatetime] = {
                dateName,
                taskDatetime,
                tasks: [taskForHistory]
            }
        } else {
            result[taskDatetime].tasks.push(taskForHistory)            
        }

        return result
    }, {})

    const historyHTML = formatTasksAsHTML(tasksByDays)

    hideHistoryPlaceholder()
    historyContainer.innerHTML = historyHTML
}

const taskInputForm = document.getElementById("task-input-form")
const taskInput = document.getElementById("task-input")
const taskStart = document.getElementById("task-start")

const activeTaskInfo = document.getElementById("active-task-info")
const activeTaskActions = document.getElementById("active-task-actions")
const noActiveTask = document.getElementById("no-active-task")
const activeTaskName = document.getElementById("active-task-name")
const activeTaskTime = document.getElementById("active-task-time")

const pauseTaskButton = document.getElementById("task-pause")
const resumeTaskButton = document.getElementById("task-resume")
const saveTaskButton = document.getElementById("task-save")
const discardTaskButton = document.getElementById("task-discard")

const historyContainer = document.getElementById("history-container")
const historyEmpty = document.getElementById("history-empty")

let timeoutId

taskInputForm.addEventListener("submit", startTask)
pauseTaskButton.addEventListener("click", pauseTimer)
resumeTaskButton.addEventListener("click", resumeTimer)
discardTaskButton.addEventListener("click", discardTask)
saveTaskButton.addEventListener("click", saveTask)

showActiveTask()
showTasksHistory()