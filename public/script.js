const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");

const modelDropdown = document.querySelector(".model-dropdown");
const modelDropdownBtn = document.getElementById("model-dropdown-btn");
const modelOptions = document.querySelectorAll(".model-option");
const modelInfo = document.getElementById("model-info");

// Model descriptions
const modelDescriptions = {
    "gemini-1.5-flash": "Gemini 1.5 Flash is a fast and versatile multimodal model for scaling across diverse tasks.",
    "gemini-2.0-flash": "Gemini 2.0 Flash delivers next-gen features and improved capabilities, including superior speed, native tool use, multimodal generation, and a 1M token context window."
};
let selectedModel = localStorage.getItem("selectedModel") || "gemini-1.5-flash";
// Update button text on page load
updateDropdownText(selectedModel);
// Toggle dropdown visibility
modelDropdownBtn.addEventListener("click", () => {
    modelDropdown.classList.toggle("active");
});
// Handle model selection
modelOptions.forEach(option => {
    option.addEventListener("click", (event) => {
        selectedModel = event.currentTarget.dataset.model;
        localStorage.setItem("selectedModel", selectedModel); // Save to localStorage
        updateDropdownText(selectedModel);
        modelDropdown.classList.remove("active");
        console.log(`Switched to model: ${selectedModel}`);
    });
});
// Update dropdown button text based on selected model
function updateDropdownText(model) {
    let text = model === "gemini-1.5-flash" ? "Gemini 1.5 Flash" : "Gemini 2.0 Flash";
    modelDropdownBtn.innerHTML = text + ' <svg xmlns="http://www.w3.org/2000/svg" height="35px" viewBox="0 -960 960 960" width="35px" fill="#e3e3e3"><path d="M480-360 280-559h400L480-360Z"/></svg>';
    // Remove "selected" class from all options
    modelOptions.forEach(option => option.classList.remove("selected"));

    // Add "selected" class to the correct option
    document.querySelector(`.model-option[data-model="${model}"]`).classList.add("selected");
     // Update model description
     modelInfo.textContent = modelDescriptions[model];
}

// Fetch API Key from backend before making requests
let API_KEY = "";
fetch("/api/config")
    .then(response => response.json())
    .then(data => {
        API_KEY = data.googleApiKey;
        // console.log("API Key loaded successfully"); // Debugging
    })
    .catch(error => console.error("Error fetching API key:", error));
const getApiUrl = () => {
    return `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}`;
}
// Change model when user selects a different one


let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

// Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Function to create message elements
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// Scroll to the bottom of the container
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;
    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
        }
    }, 40); // 40 ms delay
};

const responseFilter = (text) => {
    const replacements = {
        "Google": "NiCKK",
        "Gemini": "NiCKK",
        "I am developed by Google": "I am an AI created using advanced language models and based on Google's Gemini",
        "I was made by Google": "I was built using Gemini's Api",
        "I am a product of Google": "I am a custom-built chatbot",
    };

    // Replace words using regular expressions
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${key}\\b`, "gi"); // Match whole words, case insensitive
        text = text.replace(regex, value);
    }
    return text;
};

// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    controller = new AbortController();

    chatHistory.push({
        role: "user",
        parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
    });

    try {
        if (!API_KEY) {
            throw new Error("API Key not loaded. Please refresh the page.");
        }

        // Send request to API
        const response = await fetch(getApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        // Process response text and apply filtering
        let responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
        responseText = responseFilter(responseText);

        // ✅ Apply structured formatting (headers, lists, code)
        responseText = formatStructuredResponse(responseText);

        // ✅ Wrap message properly
        botMsgDiv.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <dotlottie-player 
                    src="https://lottie.host/38202b3d-5184-43bf-b09d-bf12040760ff/tTM7lKQEcq.lottie" 
                    background="transparent" 
                    speed="2.5" 
                    style="width: 40px; height: 40px;" 
                    loop autoplay>
                </dotlottie-player>
                <div style="max-width: 80%;">${responseText}</div>
            </div>
        `;

        chatHistory.push({ role: "model", parts: [{ text: responseText }] });

        // ✅ Highlight code blocks
        document.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
        });

    } catch (error) {
        textElement.textContent = error.message;
        textElement.style.color = "#d62939";
    } finally {
        document.body.classList.remove("bot-responding"); // ✅ Enable new message input
        botMsgDiv.classList.remove("loading"); // ✅ Ensure message is fully displayed
        userData.file = {};
        scrollToBottom();
    }
};




const formatCodeBlocks = (text) => {
    return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
        return `<pre><code class="language-${language || 'plaintext'}">${escapeHtml(code)}</code></pre>`;
    });
};

// Escape HTML to prevent UI issues
const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const formatStructuredResponse = (text) => {
    // Convert headers (`**Title**`) to <strong> tags
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Convert bullet points (`* item`) to proper lists
    text = text.replace(/\n\* (.*?)\n/g, "<ul><li>$1</li></ul>");

    // Convert numbered lists (`1. item`) to ordered lists
    text = text.replace(/\n\d+\. (.*?)\n/g, "<ol><li>$1</li></ol>");

    // Convert code blocks (` ```code``` `) to <pre><code> blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
        return `<pre><code class="language-${language || 'plaintext'}">${escapeHtml(code)}</code></pre>`;
    });

    return text;
};


const customResponses = {
    "who made you": "I was built using AI technologies to assist users like you!",
    "who are you": "I am your personal AI assistant, designed to provide helpful responses.",
    "what is your purpose": "I am here to assist with any questions you have!"
};
// Handle the form submission
const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    userData.message = userMessage;
    promptInput.value = "";
    document.body.classList.add("chats-active", "bot-responding");

    fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

    // Display user message
    const userMsgHTML = `<p class="message-text">${userData.message}</p>`;
    const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() => {
        // ✅ Ensure "Just a sec..." is left-aligned
        const botMsgDiv = createMessageElement(`
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <dotlottie-player 
                    src="https://lottie.host/38202b3d-5184-43bf-b09d-bf12040760ff/tTM7lKQEcq.lottie" 
                    background="transparent" 
                    speed="2.5" 
                    style="width: 40px; height: 40px;" 
                    loop autoplay>
                </dotlottie-player>
                <p class="message-text">Just a sec...</p>
            </div>
        `, "bot-message", "loading");

        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();

        generateResponse(botMsgDiv);
    }, 600);
};


// ✅ Reset UI after bot response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
    controller?.abort();
    document.body.classList.remove("bot-responding"); // ✅ Allow new messages
    chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
});



// Attach event listeners
promptForm.addEventListener("submit", handleFormSubmit);
themeToggleBtn.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

document.addEventListener("DOMContentLoaded", () => {
    const infoPopup = document.getElementById("info-popup");
    const changelogPopup = document.getElementById("changelog-popup");
    const changelogContainer = document.getElementById("changelog-container");
    const openChangelogBtn = document.getElementById("open-changelog");
    const closeChangelogBtn = document.getElementById("close-changelog-btn");
    const closePopup = document.getElementById("close-popup");

    let changelogLoaded = false;
    let changelogContent = "";

    // ✅ Prevent scrolling when popups are open
    function toggleBodyScroll(disable) {
        document.body.classList.toggle("no-scroll", disable);
    }

    // ✅ Function to Open Any Popup
    function openPopup(popup) {
        popup.classList.add("active");
        toggleBodyScroll(true);
    }

    // ✅ Function to Close Any Popup
    function closePopupHandler(popup) {
        popup.classList.remove("active");
        toggleBodyScroll(false);
    }

    // ✅ Function to Load Changelog from JSON
    async function loadChangelog() {
        if (changelogLoaded) return; // Prevent duplicate fetch calls
        try {
            const response = await fetch("changelog.json");
            if (!response.ok) throw new Error("Failed to fetch changelog.");
            const data = await response.json();

            changelogContent = formatChangelog(data);
            changelogContainer.innerHTML = changelogContent; // ✅ Store content before showing popup
            changelogLoaded = true;
        } catch (error) {
            changelogContainer.innerHTML = "<p>Error loading changelog. Please try again.</p>";
        }
    }

    function formatChangelog(data) {
        let html = "<h2>Changelog</h2>";
        data.versions.forEach(version => {
            html += `
                <p><strong>Version ${version.version}</strong> - (${version.date})</p>
                <ul>
                    ${version.changes.map(change => `<li>${change}</li>`).join("")}
                </ul>
            `;
        });
        return html;
    }

    // ✅ Show info popup only on first visit
    if (!localStorage.getItem("popupShown")) {
        setTimeout(() => {
            openPopup(infoPopup);
        }, 500);
    }

    closePopup?.addEventListener("click", async () => {
        closePopupHandler(infoPopup);
        localStorage.setItem("popupShown", "true");

        // ✅ Preload changelog before opening popup
        changelogContainer.innerHTML = "<p>Loading changelog...</p>";
        await loadChangelog(); // ✅ Load before showing popup

        setTimeout(() => {
            openPopup(changelogPopup);
        }, 500);
    });

    // ✅ Open Changelog Popup Correctly
    function openChangelogPopup() {
        openPopup(changelogPopup);
        if (changelogLoaded) {
            changelogContainer.innerHTML = changelogContent; // ✅ Use stored content
        } else {
            changelogContainer.innerHTML = "<p>Loading changelog...</p>";
            loadChangelog();
        }
    }

    openChangelogBtn?.addEventListener("click", () => {
        openChangelogPopup();
    });

    closeChangelogBtn?.addEventListener("click", () => {
        closePopupHandler(changelogPopup);
    });

    // ✅ Close Popup When Clicking Outside
    changelogPopup?.addEventListener("click", (event) => {
        if (event.target === changelogPopup) {
            closePopupHandler(changelogPopup);
        }
    });
});


document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const registerBtn = document.getElementById("register-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const chatbotContainer = document.querySelector(".prompt-container");

    // ✅ Check if user is logged in
    function checkUserAuth() {
        const token = localStorage.getItem("token");
        if (token) {
            loginBtn.style.display = "none";
            registerBtn.style.display = "none";
            logoutBtn.style.display = "block";
            chatbotContainer.style.display = "block";
        } else {
            loginBtn.style.display = "block";
            registerBtn.style.display = "block";
            logoutBtn.style.display = "none";
            chatbotContainer.style.display = "none"; // ✅ Hide chatbot for non-logged-in users
        }
    }

    checkUserAuth();

    // ✅ Handle Registration
    registerBtn.addEventListener("click", async () => {
        const email = prompt("Enter your email:");
        const password = prompt("Enter your password:");

        if (email && password) {
            try {
                const response = await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                alert(data.message || data.error);
            } catch (error) {
                console.error("Registration failed", error);
            }
        }
    });

    // ✅ Handle Login
    loginBtn.addEventListener("click", async () => {
        const email = prompt("Enter your email:");
        const password = prompt("Enter your password:");

        if (email && password) {
            try {
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (data.token) {
                    localStorage.setItem("token", data.token);
                    alert("Login successful!");
                    checkUserAuth();
                } else {
                    alert(data.error);
                }
            } catch (error) {
                console.error("Login failed", error);
            }
        }
    });

    // ✅ Handle Logout
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        alert("Logged out successfully!");
        checkUserAuth();
    });
});