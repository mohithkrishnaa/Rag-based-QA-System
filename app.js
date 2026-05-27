const API_BASE = "http://127.0.0.1:8000/api";

const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");
const btnSummarize = document.getElementById("btn-summarize");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const modelSelect = document.getElementById("model-select");

// File Upload Logic
uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    if (!file.name.endsWith('.pdf')) {
        uploadStatus.textContent = "Please upload a PDF file.";
        uploadStatus.className = "status-message error";
        return;
    }

    uploadStatus.textContent = "Processing document...";
    uploadStatus.className = "status-message loading";
    btnSummarize.disabled = true;
    chatInput.disabled = true;
    btnSend.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(await response.text());
        
        uploadStatus.textContent = "Document ready!";
        uploadStatus.className = "status-message success";
        
        // Enable UI
        btnSummarize.disabled = false;
        chatInput.disabled = false;
        btnSend.disabled = false;
        
        addMessage("system", "Document loaded successfully. You can now ask questions or request a summary.");
    } catch (error) {
        uploadStatus.textContent = "Upload failed.";
        uploadStatus.className = "status-message error";
        console.error(error);
    }
}

// Chat UI Logic
function addMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}-msg`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "👤" : "🤖";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    // Very basic markdown handling for newlines
    bubble.innerHTML = text.replace(/\n/g, "<br>");

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble; // Return the text container so we can stream into it
}

// Handle Summarize
btnSummarize.addEventListener("click", async () => {
    const bubble = addMessage("system", "▌");
    btnSummarize.disabled = true;
    chatInput.disabled = true;
    btnSend.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/summarize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelSelect.value })
        });

        if (!response.ok) throw new Error("Failed to summarize");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
            bubble.innerHTML = fullText.replace(/\n/g, "<br>") + "▌";
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        bubble.innerHTML = fullText.replace(/\n/g, "<br>");
    } catch (error) {
        bubble.textContent = "Error generating summary.";
        console.error(error);
    } finally {
        btnSummarize.disabled = false;
        chatInput.disabled = false;
        btnSend.disabled = false;
    }
});

// Handle Q&A
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query) return;

    // Add user message
    addMessage("user", query);
    chatInput.value = "";
    
    // Prepare for AI response
    const bubble = addMessage("system", "▌");
    btnSummarize.disabled = true;
    chatInput.disabled = true;
    btnSend.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, model: modelSelect.value })
        });

        if (!response.ok) throw new Error("Failed to chat");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
            bubble.innerHTML = fullText.replace(/\n/g, "<br>") + "▌";
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        bubble.innerHTML = fullText.replace(/\n/g, "<br>");
    } catch (error) {
        bubble.textContent = "Error getting answer.";
        console.error(error);
    } finally {
        btnSummarize.disabled = false;
        chatInput.disabled = false;
        btnSend.disabled = false;
        chatInput.focus();
    }
});
