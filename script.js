'use strict';

(function() { // IIFE (Immediately Invoked Function Expression)

// --- Configuration (التكوين) ---
const apiKeyGemini = 'AIzaSyAJ5AVTVNbNiOTatAKH1VI3q_9eJppclYE'; // **هام: استبدل هذا بمفتاح Gemini API الفعلي الخاص بك! (للتجربة فقط)**
const modelNameGemini = 'gemini-2.0-flash'; // تم تحديث النموذج إلى gemini-2.0-flash
const defaultTemperature = 0.6;
const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelNameGemini}:generateContent?key=${apiKeyGemini}`; // تعريف نقطة النهاية API

// --- State Variables (متغيرات الحالة) ---
let conversationHistory = [];
let isFetchingResponse = false;
let attachedImageFile = null; // متغير لتخزين ملف الصورة المرفق

// --- Utility Functions (دوال مساعدة) ---

function decodeHTMLEntities(text) {
    const tempElement = document.createElement('textarea');
    tempElement.innerHTML = text;
    return tempElement.value;
}

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function handleTextareaInput() {
    adjustTextareaHeight(document.getElementById('chat_bot'));
}

let timeoutId;
function showSuccessMessage() {
    const alertDiv = document.querySelector('.success-alert');
    alertDiv.classList.add('show');
    clearTimeout(timeoutId); // Clear previous timeouts
    timeoutId = setTimeout(() => alertDiv.classList.remove('show'), 4000);
}

// **دالة لتحويل File object إلى جزء Gemini API للصور**
async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

// --- Gemini Initialization (تهيئة Gemini) ---
async function initializeGemini() {
    if (apiKeyGemini === 'YOUR_API_KEY_HERE' || apiKeyGemini === 'AIzaSyAJ5AVTVNbNiOTatAKH1VI3q_9eJppclYE') { // فحص إضافي لتذكير المستخدم بتغيير المفتاح
        console.warn("تنبيه: تستخدم مفتاح Gemini API افتراضي أو تجريبي! للتشغيل الفعلي، الرجاء استبداله بمفتاحك الفعلي في ملف script.js.");
    }
    console.log("Gemini API direct calls will be used. SDK initialization skipped."); // رسالة توضيحية
}

// --- Message Handling (معالجة الرسائل) ---

// **Improved Text Segmentation (تقسيم النص المحسن)**
function segmentText(messageText) {
    const segments = [];
    let currentText = '';
    let inCodeBlock = false;

    const lines = messageText.split('\n'); // Split into lines

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                segments.push({ type: 'code', text: currentText });
                currentText = '';
                inCodeBlock = false;
            } else {
                // Start of code block or regular text
                if (currentText) {
                    segments.push({ type: 'text', text: currentText });
                }
                currentText = '';
                inCodeBlock = true;
            }
        } else {
            currentText += line + '\n'; // Add the line and newline character
        }
    }

    // Add any remaining text
    if (currentText) {
        segments.push({ type: inCodeBlock ? 'code' : 'text', text: currentText });
    }

    return segments;
}

// **Asynchronous Text Display (عرض النص بشكل غير متزامن)**
function typeWriter(segments, segmentIndex = 0) {
    if (segmentIndex >= segments.length) {
        // Highlighting and copy button AFTER all typing is complete
        document.querySelectorAll('pre code').forEach(block => {
            if (block.textContent.trim()) { // Check for empty code blocks
                hljs.highlightElement(block);
                if (typeof hljs.lineNumbersBlock === 'function') {
                    hljs.lineNumbersBlock(block);
                }
                const preElement = block.parentNode;
                if (preElement) {
                    preElement.style.position = 'relative';
                    preElement.insertAdjacentHTML('beforeend', copyButtonHTML);
                }
            }
        });
        return;
    }

    const segment = segments[segmentIndex];
    const element = segment.element;
    const text = segment.text;

    const words = text.split(/(\s+)/); // Split into words and spaces
    let wordIndex = 0;
    let currentText = '';

    function typingFrame() {
        let frameWords = '';
        let wordsToAdd = Math.min(4, words.length - wordIndex); // Up to 4 words per frame

        for (let i = 0; i < wordsToAdd; i++) {
            frameWords += words[wordIndex++];
        }
        currentText += frameWords;

        if (segment.type === 'code') {
            element.textContent = currentText; // Use textContent for code
        } else {
            element.innerHTML = marked.parse(currentText); // Use innerHTML for Markdown
        }

        if (wordIndex < words.length) {
            requestAnimationFrame(typingFrame);
        } else {
            typeWriter(segments, segmentIndex + 1); // Next segment
        }
    }

    requestAnimationFrame(typingFrame); // Start the animation
}


// **Append Message to UI (إضافة الرسالة إلى واجهة المستخدم)**
function appendMessage(sender, messageText) {
    const mainMessagesDiv = document.querySelector('main');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    mainMessagesDiv.appendChild(messageDiv);

    const segments = segmentText(messageText); // Use improved segmentation
    const typedSegments = [];

    for (const segment of segments) {
        if (segment.type === 'code') {
            const codeBlockDiv = document.createElement('div');
            const preElement = document.createElement('pre');
            const codeElement = document.createElement('code');
            preElement.appendChild(codeElement);
            codeBlockDiv.appendChild(preElement);
            messageDiv.appendChild(codeBlockDiv);
            typedSegments.push({ text: segment.text, element: codeElement, type: 'code' });
        } else {
            const textElement = document.createElement('div'); // Use a div for text
            messageDiv.appendChild(textElement); // Append directly
            typedSegments.push({ text: segment.text, element: textElement, type: 'text' });
        }
    }

    typeWriter(typedSegments); // Pass the correctly created elements
    mainMessagesDiv.scrollTop = mainMessagesDiv.scrollHeight;
}


// --- Gemini API Interaction (التفاعل مع Gemini API) ---
async function getGeminiAIResponse(userMessage, files = []) { // تم إعادة تفعيل parameter للملفات
    // if (!model) { // تم حذف التحقق من النموذج
    //     console.error("Gemini model not initialized.");
    //     return "Model not initialized. Please try again.";
    // }

    const systemMessage = {
        role: 'user',
        parts: [{ text: "أنت مساعد ذكاء اصطناعي مفيد. يمكنك فهم النصوص والصور. تم تصميم هذا النموذج بواسطة شركة الأحرار." }], // System prompt محدث لدعم الصور وإضافة اسم الشركة
    };

    if (conversationHistory.length === 0) {
        conversationHistory = [systemMessage];
    }

    let generativeParts = []; // استخدام generativeParts هنا لتضمين النص والصور

    generativeParts.push({ text: userMessage }); // إضافة النص كجزء أول

    // **معالجة الملفات المرفقة (الآن لدعم الصور وإرسالها إلى Gemini API)**
    if (files && files.length > 0) {
        try {
            const imageParts = await Promise.all(
                Array.from(files).map(fileToGenerativePart)
            );
            generativeParts = [...generativeParts, ...imageParts]; // إضافة أجزاء الصور إلى generativeParts

        } catch (error) {
            console.error("Error processing image files:", error);
            appendMessage('bot', "Error processing image files. Please try again.");
            isFetchingResponse = false; // إعادة تمكين الإدخال
            return "Error processing image files."; // إيقاف المعالجة
        }
    }


    const requestBody = {
        contents: conversationHistory.concat([{ role: 'user', parts: generativeParts }]) // استخدام conversationHistory بالكامل وإضافة الرسالة الجديدة
    };

    // conversationHistory.push({ role: 'user', parts: generativeParts }); //  **لا تدفع هنا، يتم التحديث بعد استلام الرد**

    try {
        const response = await fetch(apiEndpoint, { // استخدام fetch API
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorDetails = await response.json(); // محاولة الحصول على تفاصيل الخطأ من JSON إذا كان متاحًا
            console.error("HTTP error!", response.status, response.statusText, errorDetails);
            return `Error from AI API: ${response.status} ${response.statusText}. Details in console.`;
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            console.error("No response from Gemini:", data);
            return "No response from AI. Please try again.";
        }

        let aiResponseContent = data.candidates[0].content.parts[0].text;
        aiResponseContent = decodeHTMLEntities(aiResponseContent);
        conversationHistory.push({ role: 'model', parts: [{ text: aiResponseContent }] }); // تحديث سجل المحادثة هنا بعد استلام الرد
        return aiResponseContent;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Error communicating with AI. Please try again.";
    }
}

// --- Form Submission (إرسال النموذج) ---
async function handleSubmit(event) {
    event.preventDefault();
    if (isFetchingResponse) return;
    isFetchingResponse = true;

    const submitButton = document.querySelector('.btn-submit');
    const textarea = document.getElementById('chat_bot');
    const fileInput = document.getElementById('file-upload'); // الحصول على مرجع لحقل رفع الملفات
    const files = fileInput.files; // FileList object

    submitButton.disabled = true;
    textarea.disabled = true;
    fileInput.disabled = true;
    textarea.placeholder = "Loading...";

    showSuccessMessage();

    const userMessage = textarea.value;
    appendMessage('user', userMessage); // عرض رسالة المستخدم النصية فوراً

    try {
        const aiResponse = await getGeminiAIResponse(userMessage, files); // تمرير الملفات إلى getGeminiAIResponse
        appendMessage('bot', aiResponse);
    } catch (apiError) {
        appendMessage('bot', "Error processing AI response.");
        console.error("Error processing AI response:", apiError);
    }


    adjustTextareaHeight(textarea);
    submitButton.disabled = false;
    textarea.disabled = false;
    fileInput.disabled = false;
    textarea.placeholder = "✦˚ تخيَّل شيئًا واكتبه هنا...";
    isFetchingResponse = false;
}

// --- Model Info Modal (نافذة معلومات النموذج) ---
function showModelInfo() {
    const modelInfo = document.getElementById("model-info");
    modelInfo.style.display = "block";
    document.querySelector('#model-info .model-content p').innerHTML = `...`; // Your model info
}

// --- Copy Button HTML (HTML زر النسخ) ---
const copyButtonHTML = `
<button class="btn-copy">
    <span class="cp-tooltip" data-text-initial="نسخ الكود" data-text-end="تم النسخ!"></span>
    <svg class="cp-clipboard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M16 2v2H6V2H4v20h2V4h10v18h2V2z"/><path d="M22 7h-4v2h4V7zm-6 0v2H8V7h8zm-8 4v2h10v-2H8zm2 4v2h6v-2H10zm-2 4v2h4v-2H8z"/></svg>
    <svg class="cp-check-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-4.85-8.514l-3.535-3.536 1.414-1.414 2.12 2.12 4.243-4.242 1.414 1.414-5.657 5.658z"/></svg>
</button>
`;

// --- Event Listeners and Initialization (مستمعو الأحداث والتهيئة) ---
window.onload = function () {
    const textarea = document.getElementById('chat_bot');
    const attachButton = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreviewElement = document.getElementById('image-preview');
    const deleteImageButton = document.getElementById('delete-image-btn');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const newChatBtn = document.getElementById('new-chat-btn');
    const mainElement = document.querySelector('main');


    textarea.addEventListener('input', handleTextareaInput);
    adjustTextareaHeight(textarea);

    document.querySelector('.btn-submit').addEventListener('click', handleSubmit);

    document.getElementById('btn-message').onclick = showModelInfo;

    const modelInfoElement = document.getElementById("model-info");
    document.querySelector('.close')?.addEventListener('click', () => modelInfoElement.style.display = "none");
    window.addEventListener('click', (event) => {
        if (event.target == modelInfoElement) {
            modelInfoElement.style.display = "none";
        }
    });

    // Marked.js configuration (with highlight.js integration)
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: true, // Crucial for security
        highlight: function (code, lang) {
            const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language: validLang }).value;
        }
    });

    // Initial highlight (if any code is present on page load)
    hljs.highlightAll();

    // Copy to clipboard (using event delegation)
    document.addEventListener('click', function (event) {
        if (event.target.closest('.btn-copy')) {
            const copyButton = event.target.closest('.btn-copy');
            const codeElement = copyButton.closest('pre')?.querySelector('code');
            if (codeElement) {
                const codeText = codeElement.innerText; // Use innerText
                navigator.clipboard?.writeText(codeText).then(() => {
                    const tooltip = copyButton.querySelector('.cp-tooltip');
                    tooltip.textContent = tooltip.dataset.textEnd;
                    setTimeout(() => tooltip.textContent = tooltip.dataset.textInitial, 2000);
                }).catch(err => {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy code.');
                });
            }
        }
    });

    // Sidebar logic
    const sidebarHiddenClass = 'sidebar-hidden';

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        mainElement.classList.toggle(sidebarHiddenClass);
        sidebarToggleBtn.classList.toggle(sidebarHiddenClass);
    });

    newChatBtn.addEventListener('click', () => {
        conversationHistory = [];
        document.querySelector('main').innerHTML = `<p style="margin-bottom: 20px; font-size: 1.2em; color: #9ca3af;">ابدأ محادثتك الآن واكتشف قوة الذكاء الاصطناعي</p>`; // reset placeholder text in main
        adjustTextareaHeight(textarea);
        textarea.value = '';
        sidebar.classList.add('hidden');
        mainElement.classList.add(sidebarHiddenClass);
        sidebarToggleBtn.classList.add(sidebarHiddenClass);
         // Clear image preview as well
        clearImagePreview();
        fileInput.value = '';
        attachedImageFile = null;
    });


    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    });

    // **زر الإرفاق ورفع الملفات**
    attachButton.addEventListener('click', () => {
        fileInput.click(); // عند النقر على زر الإرفاق، يتم فتح مربع اختيار الملفات
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; // Get only the first selected file
        if (file) {
            attachedImageFile = file; // Store the file
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreviewElement.src = e.target.result;
                imagePreviewElement.style.display = 'block'; // إظهار معاينة الصورة
                deleteImageButton.style.display = 'flex'; // إظهار زر الحذف
                imagePreviewContainer.style.display = 'flex'; // إظهار حاوية الصورة
                adjustTextareaHeight(textarea); // إعادة ضبط ارتفاع حقل النص
            }
            reader.readAsDataURL(file);
        } else {
            clearImagePreview(); // If no file selected, clear preview
        }
    });

    // **زر حذف الصورة**
    deleteImageButton.addEventListener('click', (event) => {
        event.preventDefault(); // منع إرسال النموذج عند النقر على الزر داخل النموذج
        clearImagePreview();
        fileInput.value = ''; // Clear the file input
        attachedImageFile = null; // Clear stored file
    });

    function clearImagePreview() {
        imagePreviewElement.src = '';
        imagePreviewElement.style.display = 'none';
        deleteImageButton.style.display = 'none';
        imagePreviewContainer.style.display = 'none';
        adjustTextareaHeight(textarea);
    }


    initializeGemini(); // Initialize Gemini AFTER event listeners are set up
};

})();