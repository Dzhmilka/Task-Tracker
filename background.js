const ext = self.browser ?? self.chrome 

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

async function restoreIcon() {
    const { activeTask } = await ext.storage.local.get("activeTask")

    if (!activeTask) {
        setIcon("idle")
        return
    }

    if (activeTask.isRunning) {
        setIcon("running")
    } else {
        setIcon("paused")
    }
}

restoreIcon()

ext.runtime.onStartup.addListener(restoreIcon)
ext.runtime.onInstalled.addListener(restoreIcon)
ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.activeTask) return

    const newTask = changes.activeTask.newValue

    if (!newTask) {
        setIcon("idle")
    } else if (newTask.isRunning) {
        setIcon("running")
    } else {
        setIcon("paused")
    }
})