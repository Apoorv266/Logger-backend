// monitoring/EventQueue.js

const queue = []

export function addEvent(event) {
    queue.push(event)
}


export function getQueue() {
    const events = [...queue]
    queue.length = 0
    return events
}

export function clearQueue() {
    queue.length = 0
}

