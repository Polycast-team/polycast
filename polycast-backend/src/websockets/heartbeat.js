function heartbeat() {
    this.isAlive = true;
    console.log('Received pong from client');
}

function setupHeartbeat(wss) {
    const pingInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log('Client did not respond to ping, terminating connection');
                return ws.terminate();
            }
            
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(pingInterval);
        console.log('WebSocket server closed, cleared ping interval');
    });

    console.log(`WebSocket server created with heartbeat enabled.`);

    return heartbeat;
}

module.exports = setupHeartbeat;
