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

async function showTasksHistory() {
    const { historyTasks } = await browser.storage.local.get("historyTasks")
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

let timeoutId

taskInputForm.addEventListener("submit", startTask)
pauseTaskButton.addEventListener("click", pauseTimer)
resumeTaskButton.addEventListener("click", resumeTimer)
discardTaskButton.addEventListener("click", discardTask)
saveTaskButton.addEventListener("click", saveTask)

showActiveTask()