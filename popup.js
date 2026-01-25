function startTask() {
    const taskName = taskInput.value
    browser.storage.local.set({
        activeTask: {
            name: taskName,
            start: Date.now(),
            isRunning: true
        }    
    })
}

async function showActiveTask() {
    const activeTask = await browser.storage.local.get("activeTask")
    console.log(activeTask)
}

const taskInput = document.getElementById("task-input")
const taskStart = document.getElementById("task-start")

taskStart.addEventListener("click", startTask)
showActiveTask()