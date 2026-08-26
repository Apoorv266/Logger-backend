// monitoring/EventQueue.js

const queue = []

export function addEvent(event) {
    queue.push(event)
}

export function getQueue() {
    return queue.splice(0, queue.length)
}
