// Mobile Detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// State Management
let cluster = {
    nodes: [],
    pods: [],
    algorithm: 'spread',
    maxNodes: 6 // Limit for mobile
};

let podQueue = [];
let podCounter = 1;
let nodeCounter = 1;

// DOM Elements
let dragPodId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 K8s Scheduler Simulator - Mobile Ready");
    
    // Show mobile overlay on first visit
    if (isMobile && !localStorage.getItem('mobileTipsShown')) {
        document.getElementById('mobile-overlay').style.display = 'flex';
    } else {
        document.getElementById('mobile-overlay').style.display = 'none';
    }
    
    // Initialize cluster with sample nodes
    createSampleNodes();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize drag and drop
    initDragAndDrop();
    
    // Update UI
    updateUI();
    
    // Log startup message
    logMessage("System initialized. Ready to schedule pods!", "info");
});

// Event Listeners Setup
function setupEventListeners() {
    // CPU/Memory sliders
    document.getElementById('pod-cpu').addEventListener('input', function(e) {
        document.getElementById('cpu-value').textContent = e.target.value;
    });
    
    document.getElementById('pod-memory').addEventListener('input', function(e) {
        document.getElementById('memory-value').textContent = e.target.value;
    });
    
    // Algorithm selector
    document.getElementById('algorithm').addEventListener('change', function(e) {
        cluster.algorithm = e.target.value;
        logMessage(`Scheduler algorithm changed to: ${getAlgorithmName(e.target.value)}`, "info");
    });
    
    // Initialize sliders display
    document.getElementById('cpu-value').textContent = document.getElementById('pod-cpu').value;
    document.getElementById('memory-value').textContent = document.getElementById('pod-memory').value;
}

// Create sample nodes
function createSampleNodes() {
    cluster.nodes = [
        createNode('Worker-1', 4, 8192),
        createNode('Worker-2', 4, 8192),
        createNode('GPU-Node', 8, 16384)
    ];
    nodeCounter = 4;
}

// Create a new node
function createNode(name, cpu, memory) {
    return {
        id: `node-${nodeCounter++}`,
        name: name,
        cpu: { total: cpu, used: 0 },
        memory: { total: memory, used: 0 },
        pods: []
    };
}

// Create a pod
function createPod() {
    if (podQueue.length >= 10) {
        showAlert("Queue full! Please schedule existing pods first.");
        return;
    }
    
    const podName = document.getElementById('pod-name').value || `pod-${podCounter++}`;
    const cpuReq = parseFloat(document.getElementById('pod-cpu').value);
    const memoryReq = parseInt(document.getElementById('pod-memory').value);
    
    const pod = {
        id: `pod-${Date.now()}`,
        name: podName,
        cpu: cpuReq,
        memory: memoryReq,
        status: 'pending',
        createdAt: new Date()
    };
    
    podQueue.push(pod);
    logMessage(`Pod "${podName}" created (CPU: ${cpuReq}, Memory: ${memoryReq}MB)`, "create");
    
    // Auto-schedule after short delay
    setTimeout(() => {
        schedulePod(pod);
    }, 500);
    
    updateUI();
    return pod;
}

// Quick create pod (for mobile button)
function quickCreatePod() {
    // Generate random pod
    const pods = ['web-server', 'database', 'cache', 'api', 'worker', 'frontend'];
    const randomPod = pods[Math.floor(Math.random() * pods.length)];
    
    document.getElementById('pod-name').value = `${randomPod}-${podCounter++}`;
    document.getElementById('pod-cpu').value = (Math.random() * 3 + 0.5).toFixed(1);
    document.getElementById('pod-memory').value = Math.floor(Math.random() * 4096 + 128);
    
    // Update display
    document.getElementById('cpu-value').textContent = document.getElementById('pod-cpu').value;
    document.getElementById('memory-value').textContent = document.getElementById('pod-memory').value;
    
    createPod();
}

// Schedule a pod
function schedulePod(pod) {
    let selectedNode = null;
    
    switch(cluster.algorithm) {
        case 'spread':
            selectedNode = scheduleSpread(pod);
            break;
        case 'binpack':
            selectedNode = scheduleBinPack(pod);
            break;
        case 'random':
            selectedNode = scheduleRandom(pod);
            break;
        default:
            selectedNode = scheduleSpread(pod);
    }
    
    if (selectedNode) {
        deployPodToNode(pod, selectedNode);
        // Remove from queue
        const index = podQueue.findIndex(p => p.id === pod.id);
        if (index > -1) {
            podQueue.splice(index, 1);
        }
    } else {
        logMessage(`No suitable node found for pod "${pod.name}". Added to waiting queue.`, "warning");
    }
    
    updateUI();
}

// Spread algorithm
function scheduleSpread(pod) {
    let bestNode = null;
    let minUsage = Infinity;
    
    for (const node of cluster.nodes) {
        const cpuUsage = (node.cpu.used / node.cpu.total) * 100;
        const memoryUsage = (node.memory.used / node.memory.total) * 100;
        const avgUsage = (cpuUsage + memoryUsage) / 2;
        
        if (hasEnoughResources(node, pod) && avgUsage < minUsage) {
            minUsage = avgUsage;
            bestNode = node;
        }
    }
    
    return bestNode;
}

// Bin Packing algorithm
function scheduleBinPack(pod) {
    let bestNode = null;
    let maxUsage = -1;
    
    for (const node of cluster.nodes) {
        const cpuUsage = node.cpu.used / node.cpu.total;
        const memoryUsage = node.memory.used / node.memory.total;
        const avgUsage = (cpuUsage + memoryUsage) / 2;
        
        if (hasEnoughResources(node, pod) && avgUsage > maxUsage) {
            maxUsage = avgUsage;
            bestNode = node;
        }
    }
    
    return bestNode;
}

// Random algorithm
function scheduleRandom(pod) {
    const suitableNodes = cluster.nodes.filter(node => hasEnoughResources(node, pod));
    return suitableNodes.length > 0 
        ? suitableNodes[Math.floor(Math.random() * suitableNodes.length)]
        : null;
}

// Check resources
function hasEnoughResources(node, pod) {
    const cpuAvailable = node.cpu.total - node.cpu.used;
    const memoryAvailable = node.memory.total - node.memory.used;
    
    return cpuAvailable >= pod.cpu && memoryAvailable >= pod.memory;
}

// Deploy pod to node
function deployPodToNode(pod, node) {
    pod.status = 'running';
    pod.nodeId = node.id;
    pod.scheduledAt = new Date();
    
    node.cpu.used += pod.cpu;
    node.memory.used += pod.memory;
    node.pods.push(pod);
    
    cluster.pods.push(pod);
    
    logMessage(`Pod "${pod.name}" scheduled to ${node.name} using ${getAlgorithmName(cluster.algorithm)}`, "schedule");
    
    // Animate the pod deployment
    animatePodDeployment(pod, node);
}

// Animate pod deployment
function animatePodDeployment(pod, node) {
    // This would be a visual animation
    console.log(`Animating pod ${pod.name} to node ${node.name}`);
}

// Add a new node
function addNode() {
    if (cluster.nodes.length >= cluster.maxNodes) {
        showAlert(`Maximum ${cluster.maxNodes} nodes allowed on mobile`);
        return;
    }
    
    const nodeNames = ['Worker', 'Master', 'Storage', 'Compute', 'GPU'];
    const randomName = nodeNames[Math.floor(Math.random() * nodeNames.length)];
    
    // Random resources
    const cpu = [2, 4, 8][Math.floor(Math.random() * 3)];
    const memory = [4096, 8192, 16384][Math.floor(Math.random() * 3)];
    
    const newNode = createNode(`${randomName}-${nodeCounter}`, cpu, memory);
    cluster.nodes.push(newNode);
    
    logMessage(`New node added: ${newNode.name} (CPU: ${cpu}, Memory: ${formatMemory(memory)})`, "node");
    updateUI();
}

// Reset cluster
function resetCluster() {
    if (!confirm("Reset the entire cluster? All pods will be removed.")) return;
    
    cluster.nodes.forEach(node => {
        node.cpu.used = 0;
        node.memory.used = 0;
        node.pods = [];
    });
    cluster.pods = [];
    podQueue = [];
    
    logMessage("Cluster reset to initial state", "warning");
    updateUI();
}

// Update all UI elements
function updateUI() {
    renderCluster();
    updateQueueDisplay();
    updateStats();
}

// Render cluster visualization
function renderCluster() {
    const container = document.getElementById('cluster-nodes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (cluster.nodes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server fa-3x"></i>
                <h3>No Nodes Found</h3>
                <p>Click "Add Node" to create your first node</p>
            </div>
        `;
        return;
    }
    
    cluster.nodes.forEach(node => {
        const cpuPercent = Math.min(100, (node.cpu.used / node.cpu.total) * 100);
        const memoryPercent = Math.min(100, (node.memory.used / node.memory.total) * 100);
        const cpuAvailable = (node.cpu.total - node.cpu.used).toFixed(1);
        const memoryAvailable = node.memory.total - node.memory.used;
        
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node';
        nodeEl.dataset.nodeId = node.id;
        
        nodeEl.innerHTML = `
            <div class="node-header">
                <div class="node-name">${node.name}</div>
                <div class="node-status">${node.pods.length} pod${node.pods.length !== 1 ? 's' : ''}</div>
            </div>
            
            <div class="resource-info">
                <div style="margin-bottom: 10px;">
                    <small>CPU: ${cpuAvailable}/${node.cpu.total} cores available</small>
                </div>
                <div class="resource-bar">
                    <div class="resource-fill cpu-fill" style="width: ${cpuPercent}%"></div>
                    <div class="resource-info">${cpuPercent.toFixed(0)}%</div>
                </div>
                
                <div style="margin: 15px 0 10px 0;">
                    <small>Memory: ${formatMemory(memoryAvailable)}/${formatMemory(node.memory.total)} available</small>
                </div>
                <div class="resource-bar">
                    <div class="resource-fill memory-fill" style="width: ${memoryPercent}%"></div>
                    <div class="resource-info">${memoryPercent.toFixed(0)}%</div>
                </div>
            </div>
            
            <div class="pods-container" data-dropzone="${node.id}" id="dropzone-${node.id}">
                ${node.pods.length === 0 
                    ? `<div class="empty-pods">Drag pods here</div>` 
                    : node.pods.map(pod => `
                        <div class="pod" data-pod-id="${pod.id}" draggable="true">
                            <div class="pod-info">
                                <div class="pod-name">${pod.name}</div>
                                <div class="pod-resources">
                                    CPU: ${pod.cpu} | Mem: ${formatMemory(pod.memory)}
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        container.appendChild(nodeEl);
    });
    
    // Re-initialize drag and drop
    initDragAndDrop();
}

// Update queue display
function updateQueueDisplay() {
    const queueList = document.getElementById('queue-list');
    const queueCount = document.getElementById('queue-count');
    
    if (!queueList) return;
    
    queueCount.textContent = podQueue.length;
    
    if (podQueue.length === 0) {
        queueList.innerHTML = `
            <div class="empty-queue">
                <i class="fas fa-inbox"></i>
                <p>No pods waiting</p>
            </div>
        `;
        return;
    }
    
    queueList.innerHTML = podQueue.map(pod => `
        <div class="queue-item" data-pod-id="${pod.id}">
            <div class="queue-item-info">
                <h4>${pod.name}</h4>
                <p>CPU: ${pod.cpu} | Memory: ${formatMemory(pod.memory)}</p>
            </div>
            <button class="btn btn-secondary" onclick="schedulePodNow('${pod.id}')">
                <i class="fas fa-rocket"></i>
            </button>
        </div>
    `).join('');
}

// Schedule pod from queue manually
function schedulePodNow(podId) {
    const podIndex = podQueue.findIndex(p => p.id === podId);
    if (podIndex !== -1) {
        const pod = podQueue[podIndex];
        schedulePod(pod);
    }
}

// Update statistics
function updateStats() {
    document.getElementById('mobile-pod-count').textContent = cluster.pods.length;
    
    let totalCPU = 0, usedCPU = 0, totalMemory = 0, usedMemory = 0;
    
    cluster.nodes.forEach(node => {
        totalCPU += node.cpu.total;
        usedCPU += node.cpu.used;
        totalMemory += node.memory.total;
        usedMemory += node.memory.used;
    });
    
    const cpuPercent = totalCPU > 0 ? Math.round((usedCPU / totalCPU) * 100) : 0;
    const memoryPercent = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;
    
    document.getElementById('mobile-cpu-usage').textContent = `${cpuPercent}%`;
    document.getElementById('mobile-memory-usage').textContent = `${memoryPercent}%`;
}

// Drag and Drop functionality
function initDragAndDrop() {
    if (typeof interact === 'undefined') {
        console.warn("Interact.js not loaded, drag and drop disabled");
        return;
    }
    
    // Make pods draggable
    interact('.pod').draggable({
        inertia: false,
        modifiers: [
            interact.modifiers.restrictRect({
                restriction: 'parent',
                endOnly: true
            })
        ],
        listeners: {
            start(event) {
                event.target.classList.add('dragging');
                dragPodId = event.target.getAttribute('data-pod-id');
                event.target.style.opacity = '0.5';
            },
            move(event) {
                event.target.style.transform = `translate(${event.dx}px, ${event.dy}px)`;
            },
            end(event) {
                event.target.classList.remove('dragging');
                event.target.style.opacity = '1';
                event.target.style.transform = 'none';
                dragPodId = null;
            }
        }
    });
    
    // Setup drop zones
    interact('.pods-container').dropzone({
        accept: '.pod',
        overlap: 0.5,
        
        ondropactivate(event) {
            event.target.classList.add('drag-over');
        },
        
        ondragenter(event) {
            event.target.style.backgroundColor = 'rgba(0, 212, 255, 0.1)';
        },
        
        ondragleave(event) {
            event.target.style.backgroundColor = '';
        },
        
        ondrop(event) {
            const targetNodeId = event.target.getAttribute('data-dropzone');
            if (dragPodId && targetNodeId) {
                movePodBetweenNodes(dragPodId, targetNodeId);
            }
        },
        
        ondropdeactivate(event) {
            event.target.classList.remove('drag-over');
            event.target.style.backgroundColor = '';
        }
    });
}

// Move pod between nodes
function movePodBetweenNodes(podId, targetNodeId) {
    let sourceNode = null;
    let pod = null;
    
    // Find the pod and its current node
    for (const node of cluster.nodes) {
        const podIndex = node.pods.findIndex(p => p.id === podId);
        if (podIndex !== -1) {
            sourceNode = node;
            pod = node.pods[podIndex];
            break;
        }
    }
    
    if (!pod || !sourceNode) return;
    
    const targetNode = cluster.nodes.find(n => n.id === targetNodeId);
    
    if (!targetNode) return;
    
    // Check if target node has enough resources
    if (!hasEnoughResources(targetNode, pod)) {
        showAlert(`Cannot move pod to ${targetNode.name}: Insufficient resources`);
        return;
    }
    
    // Remove from source node
    sourceNode.cpu.used -= pod.cpu;
    sourceNode.memory.used -= pod.memory;
    sourceNode.pods = sourceNode.pods.filter(p => p.id !== podId);
    
    // Add to target node
    targetNode.cpu.used += pod.cpu;
    targetNode.memory.used += pod.memory;
    targetNode.pods.push(pod);
    pod.nodeId = targetNode.id;
    
    logMessage(`Pod "${pod.name}" manually moved from ${sourceNode.name} to ${targetNode.name}`, "move");
    updateUI();
}

// Log messages
function logMessage(message, type = 'info') {
    const logContainer = document.getElementById('log-entries');
    if (!logContainer) return;
    
    const icon = {
        'info': 'fa-info-circle',
        'create': 'fa-plus-circle',
        'schedule': 'fa-rocket',
        'warning': 'fa-exclamation-triangle',
        'node': 'fa-server',
        'move': 'fa-exchange-alt'
    }[type] || 'fa-info-circle';
    
    const color = {
        'info': '#00d4ff',
        'create': '#4caf50',
        'schedule': '#ff9800',
        'warning': '#ff5722',
        'node': '#9c27b0',
        'move': '#673ab7'
    }[type] || '#00d4ff';
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.style.borderLeftColor = color;
    logEntry.innerHTML = `
        <i class="fas ${icon}" style="color: ${color}"></i>
        <span>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}: ${message}</span>
    `;
    
    // Add to top
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Keep only last 15 entries
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 15) {
        logContainer.removeChild(entries[entries.length - 1]);
    }
}

// Clear log
function clearLog() {
    const logContainer = document.getElementById('log-entries');
    if (logContainer) {
        logContainer.innerHTML = `
            <div class="log-entry welcome">
                <i class="fas fa-info-circle"></i>
                <span>Log cleared. Ready for new messages!</span>
            </div>
        `;
    }
}

// Show alert
function showAlert(message) {
    if (isMobile) {
        alert(message);
    } else {
        // Could use a nicer alert system for desktop
        alert(message);
    }
}

// UI Helper Functions
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const content = panel.querySelector('.panel-content');
    const chevron = panel.querySelector('.fa-chevron-down');
    
    content.classList.toggle('collapsed');
    chevron.style.transform = content.classList.contains('collapsed') 
        ? 'rotate(0deg)' 
        : 'rotate(180deg)';
}

function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('active');
}

function closeMobileOverlay() {
    document.getElementById('mobile-overlay').style.display = 'none';
    localStorage.setItem('mobileTipsShown', 'true');
}

function showTutorial() {
    document.getElementById('tutorial-modal').classList.add('active');
    toggleMenu();
}

function showExamples() {
    // Create example pods
    const examples = [
        { name: 'web-server', cpu: 1.5, memory: 1024 },
        { name: 'database', cpu: 2, memory: 2048 },
        { name: 'cache', cpu: 0.5, memory: 512 },
        { name: 'api-service', cpu: 1, memory: 768 }
    ];
    
    examples.forEach(example => {
        document.getElementById('pod-name').value = example.name;
        document.getElementById('pod-cpu').value = example.cpu;
        document.getElementById('pod-memory').value = example.memory;
        
        // Update display
        document.getElementById('cpu-value').textContent = example.cpu;
        document.getElementById('memory-value').textContent = example.memory;
        
        createPod();
    });
    
    toggleMenu();
    logMessage("Created example pods for web application stack", "info");
}

function showStats() {
    let statsMessage = `📊 Cluster Statistics:\n`;
    statsMessage += `• Nodes: ${cluster.nodes.length}\n`;
    statsMessage += `• Running Pods: ${cluster.pods.length}\n`;
    statsMessage += `• Queued Pods: ${podQueue.length}\n`;
    
    let totalCPU = 0, usedCPU = 0, totalMemory = 0, usedMemory = 0;
    cluster.nodes.forEach(node => {
        totalCPU += node.cpu.total;
        usedCPU += node.cpu.used;
        totalMemory += node.memory.total;
        usedMemory += node.memory.used;
    });
    
    const cpuPercent = totalCPU > 0 ? ((usedCPU / totalCPU) * 100).toFixed(1) : 0;
    const memoryPercent = totalMemory > 0 ? ((usedMemory / totalMemory) * 100).toFixed(1) : 0;
    
    statsMessage += `• CPU Usage: ${cpuPercent}%\n`;
    statsMessage += `• Memory Usage: ${memoryPercent}%\n`;
    statsMessage += `• Algorithm: ${getAlgorithmName(cluster.algorithm)}`;
    
    alert(statsMessage);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility Functions
function formatMemory(mb) {
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
}

function getAlgorithmName(algo) {
    const names = {
        'spread': 'Spread (Balanced)',
        'binpack': 'Bin Packing (Efficient)',
        'random': 'Random'
    };
    return names[algo] || algo;
}

// Make functions globally available for HTML onclick
window.createPod = createPod;
window.quickCreatePod = quickCreatePod;
window.addNode = addNode;
window.resetCluster = resetCluster;
window.schedulePodNow = schedulePodNow;
window.togglePanel = togglePanel;
window.toggleMenu = toggleMenu;
window.closeMobileOverlay = closeMobileOverlay;
window.showTutorial = showTutorial;
window.showExamples = showExamples;
window.showStats = showStats;
window.closeModal = closeModal;
window.clearLog = clearLog; 